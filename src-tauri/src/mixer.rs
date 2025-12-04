use std::sync::{Arc, Mutex};
use ringbuf::{HeapProducer, HeapConsumer, HeapRb};
use hound::WavWriter;

pub struct AudioMixer {
    sys_consumer: HeapConsumer<f32>,
    mic_consumer: HeapConsumer<f32>,
    writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    running: Arc<std::sync::atomic::AtomicBool>,
}

impl AudioMixer {
    pub fn new(writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>) -> (Self, HeapProducer<f32>, HeapProducer<f32>, Arc<std::sync::atomic::AtomicBool>) {
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
            },
            sys_prod,
            mic_prod,
            running
        )
    }

    pub fn process(&mut self) {
        while self.running.load(std::sync::atomic::Ordering::Relaxed) {
            if self.sys_consumer.is_empty() || self.mic_consumer.is_empty() {
                // Sleep briefly to avoid busy loop
                std::thread::sleep(std::time::Duration::from_millis(1));
                continue;
            }
            
            // Process chunks
            while !self.sys_consumer.is_empty() && !self.mic_consumer.is_empty() {
                let s_sys = self.sys_consumer.pop().unwrap();
                let s_mic = self.mic_consumer.pop().unwrap();
                
                let mixed = s_sys + s_mic;
                
                // Clip to prevent distortion
                let mixed = mixed.max(-1.0).min(1.0);
                
                if let Ok(mut guard) = self.writer.lock() {
                    if let Some(writer) = &mut *guard {
                        let _ = writer.write_sample(mixed);
                    }
                }
            }
        }
    }
}
