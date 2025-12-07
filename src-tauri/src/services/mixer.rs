use std::sync::{Arc, Mutex};
use ringbuf::{HeapProducer, HeapConsumer, HeapRb};
use hound::WavWriter;

pub struct AudioMixer {
    sys_consumer: HeapConsumer<f32>,
    mic_consumer: HeapConsumer<f32>,
    writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    running: Arc<std::sync::atomic::AtomicBool>,
    sys_enabled: bool,
    mic_enabled: bool,
}

impl AudioMixer {
    pub fn new(
        writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
        sys_enabled: bool,
        mic_enabled: bool
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
            },
            sys_prod,
            mic_prod,
            running
        )
    }

    pub fn process(&mut self) {
        while self.running.load(std::sync::atomic::Ordering::Relaxed) {
            // Strategy:
            // If Mic is enabled, it acts as the master clock (as it's hardware timed).
            // We wait for Mic samples. If System audio matches, we mix. If System audio is missing, we treat it as silence (0.0).
            // This prevents "silence" from system audio (SCK) blocking the recording.
            
            // If Mic is NOT enabled (System only), we wait for System samples.
            
            if self.mic_enabled {
                // Mic Master Mode
                if self.mic_consumer.is_empty() {
                    // Wait for mic
                     std::thread::sleep(std::time::Duration::from_millis(1));
                     continue;
                }
                
                // Process all available mic samples
                while !self.mic_consumer.is_empty() {
                    let s_mic = self.mic_consumer.pop().unwrap_or(0.0);
                    
                    // Try to get system sample, non-blocking
                    let s_sys = if self.sys_enabled {
                        self.sys_consumer.pop().unwrap_or(0.0) 
                    } else {
                        0.0
                    };
                    
                    let mixed = s_mic + s_sys;
                     // Clip
                    let mixed = mixed.max(-1.0).min(1.0);
                    
                    if let Ok(mut guard) = self.writer.lock() {
                        if let Some(writer) = &mut *guard {
                            let _ = writer.write_sample(mixed);
                        }
                    }
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
                         // mic is disabled so 0.0
                         let mixed = s_sys; // + 0.0
                         let mixed = mixed.max(-1.0).min(1.0);
                         
                        if let Ok(mut guard) = self.writer.lock() {
                            if let Some(writer) = &mut *guard {
                                let _ = writer.write_sample(mixed);
                            }
                        }
                    }
                    
                } else {
                    // Nothing enabled? Just sleep.
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
        }
    }
}
