use std::sync::{Arc, Mutex};
use ringbuf::{HeapProducer, HeapConsumer, HeapRb};
use hound::WavWriter;
use tauri::{AppHandle, Emitter};

pub struct AudioMixer {
    sys_consumer: HeapConsumer<f32>,
    mic_consumer: HeapConsumer<f32>,
    writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    running: Arc<std::sync::atomic::AtomicBool>,
    sys_enabled: bool,
    mic_enabled: bool,
    app_handle: AppHandle,
}

impl AudioMixer {
    pub fn new(
        writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
        sys_enabled: bool,
        mic_enabled: bool,
        app_handle: AppHandle
    ) -> (Self, HeapProducer<f32>, HeapProducer<f32>, Arc<std::sync::atomic::AtomicBool>) {
        let sys_rb = HeapRb::<f32>::new(192000); // 2 seconds buffer
        let mic_rb = HeapRb::<f32>::new(192000);
        
        let (sys_prod, sys_cons) = sys_rb.split();
        let (mic_prod, mic_cons) = mic_rb.split();
        
        let running = Arc::new(std::sync::atomic::AtomicBool::new(true));
        
        (
            Self {
                sys_consumer: sys_cons,
                mic_consumer: mic_cons,
                writer,
                running: running.clone(),
                sys_enabled,
                mic_enabled,
                app_handle,
            },
            sys_prod,
            mic_prod,
            running
        )
    }

    pub fn process(&mut self) {
        let mut sample_count = 0;
        let mut sum_squares = 0.0;
        let emit_interval = 2048; // Approx 23Hz at 48kHz, good balance for visualizer

        while self.running.load(std::sync::atomic::Ordering::Relaxed) {
             let mut process_mixed_sample = |sample: f32| {
                 // RMS Calculation
                 sum_squares += sample * sample;
                 sample_count += 1;

                 if sample_count >= emit_interval {
                     let rms = (sum_squares / sample_count as f32).sqrt();
                     // Emit event - ignore errors if app is closing
                     let _ = self.app_handle.emit("audio-level", rms);
                     
                     sum_squares = 0.0;
                     sample_count = 0;
                 }
                 
                 // Write to file
                 if let Ok(mut guard) = self.writer.lock() {
                     if let Some(writer) = &mut *guard {
                         let _ = writer.write_sample(sample);
                     }
                 }
             };

            if self.mic_enabled {
                // Mic Master Mode
                if self.mic_consumer.is_empty() {
                     std::thread::sleep(std::time::Duration::from_millis(1));
                     continue;
                }
                
                while !self.mic_consumer.is_empty() {
                    let s_mic = self.mic_consumer.pop().unwrap_or(0.0);
                    let s_sys = if self.sys_enabled {
                        self.sys_consumer.pop().unwrap_or(0.0) 
                    } else {
                        0.0
                    };
                    
                    let mixed = (s_mic + s_sys).max(-1.0).min(1.0);
                    process_mixed_sample(mixed);
                }
                
            } else {
                // System Master Mode
                if self.sys_enabled {
                    if self.sys_consumer.is_empty() {
                        std::thread::sleep(std::time::Duration::from_millis(1));
                        continue;
                    }
                    
                    while !self.sys_consumer.is_empty() {
                         let s_sys = self.sys_consumer.pop().unwrap_or(0.0);
                         let mixed = s_sys.max(-1.0).min(1.0);
                         process_mixed_sample(mixed);
                    }
                } else {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
        }
    }
}
