use screencapturekit::sc_stream::SCStream;
use screencapturekit::sc_output_handler::{StreamOutput, SCStreamOutputType};
use screencapturekit::sc_content_filter::{SCContentFilter, InitParams};
use screencapturekit::sc_stream_configuration::SCStreamConfiguration;
use screencapturekit::sc_shareable_content::SCShareableContent;
use screencapturekit::sc_error_handler::StreamErrorHandler;
use screencapturekit::cm_sample_buffer::CMSampleBuffer;

use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use hound::{WavWriter, WavSpec};
use ringbuf::{HeapProducer, HeapRb};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

use crate::mixer::AudioMixer;

struct SendStream(cpal::Stream);
unsafe impl Send for SendStream {}

pub struct AudioRecorder {
    stream: Option<SCStream>,
    mic_stream: Option<SendStream>,
    mixer: Arc<Mutex<Option<AudioMixer>>>,
    // We need to hold the producers to give them to the streams
    // But streams run in callbacks.
    // So we need to wrap producers in Arc<Mutex> or similar?
    // Ringbuf Producer is Send but not Sync?
    // Actually, we can move the producer into the callback closure/struct.
    
    // We need to store the writer to close it later?
    // The mixer holds the writer.
    writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    
    paused: Arc<std::sync::atomic::AtomicBool>,
    mixer_running: Arc<std::sync::atomic::AtomicBool>,
}



impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            stream: None,
            mic_stream: None,
            mixer: Arc::new(Mutex::new(None)),
            writer: Arc::new(Mutex::new(None)),
            paused: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            mixer_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub fn pause_recording(&self) {
        self.paused.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn resume_recording(&self) {
        self.paused.store(false, std::sync::atomic::Ordering::Relaxed);
    }

    pub async fn start_recording(&mut self, pid: i32, output_path: PathBuf) -> Result<(), String> {
        self.stop_recording()?; // Ensure stopped
        self.paused.store(false, std::sync::atomic::Ordering::Relaxed);

        // 1. Setup WAV Writer
        let spec = WavSpec {
            channels: 2,
            sample_rate: 48000,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };

        let writer = WavWriter::create(&output_path, spec)
            .map_err(|e| format!("Failed to create WAV writer: {:?}", e))?;
        
        let writer_arc = Arc::new(Mutex::new(Some(writer)));
        self.writer = writer_arc.clone();

        // 2. Setup Mixer
        let (mixer, sys_prod, mic_prod, running) = AudioMixer::new(writer_arc.clone());
        *self.mixer.lock().unwrap() = Some(mixer);
        self.mixer_running = running;
        
        // Start Mixer Thread
        let mixer_arc = self.mixer.clone();
        std::thread::spawn(move || {
            if let Ok(mut guard) = mixer_arc.lock() {
                if let Some(mixer) = &mut *guard {
                    mixer.process();
                }
            }
        });

        // ... setup mic and system audio ...


        // 3. Setup Microphone
        let host = cpal::default_host();
        let device = host.default_input_device().ok_or("No input device available")?;
        
        let config = cpal::StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(48000),
            buffer_size: cpal::BufferSize::Default,
        };

        let mic_prod_mutex = Arc::new(Mutex::new(mic_prod));
        let mic_paused = self.paused.clone();
        
        let mic_stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                if !mic_paused.load(std::sync::atomic::Ordering::Relaxed) {
                    if let Ok(mut prod) = mic_prod_mutex.lock() {
                        for &sample in data {
                            let _ = prod.push(sample);
                        }
                    }
                }
            },
            move |err| {
                eprintln!("Mic error: {:?}", err);
            },
            None
        ).map_err(|e| format!("Failed to build mic stream: {:?}", e))?;

        mic_stream.play().map_err(|e| format!("Failed to play mic stream: {:?}", e))?;
        self.mic_stream = Some(SendStream(mic_stream));

        // 4. Setup System Audio (SCK)
        let content = SCShareableContent::current();
        let window = content.windows.into_iter()
            .find(|w| w.owning_application.as_ref().map(|a| a.process_id).unwrap_or(0) == pid)
            .ok_or("No window found for target app")?;

        let filter = SCContentFilter::new(InitParams::DesktopIndependentWindow(window));
        let mut sc_config = SCStreamConfiguration::from_size(100, 100, false);
        sc_config.captures_audio = true;
        sc_config.excludes_current_process_audio = false;
        // Ensure 48kHz? SCK usually defaults to it.

        let sys_prod_mutex = Arc::new(Mutex::new(sys_prod));
        
        let mut stream = SCStream::new(filter, sc_config, ErrorHandler);
        
        let output_wrapper = OutputWrapper {
            producer: sys_prod_mutex,
            paused: self.paused.clone(),
        };
        
        stream.add_output(output_wrapper, SCStreamOutputType::Audio);

        stream.start_capture().map_err(|e| format!("Failed to start capture: {:?}", e))?;
        self.stream = Some(stream);

        Ok(())
    }

    pub fn stop_recording(&mut self) -> Result<(), String> {
        // Stop Mic
        self.mic_stream = None; 

        // Stop System Audio
        if let Some(stream) = &self.stream {
            if let Err(e) = stream.stop_capture() {
                eprintln!("Warning: Failed to stop capture: {:?}", e);
            }
        }
        self.stream = None;

        // Stop Mixer
        self.mixer_running.store(false, std::sync::atomic::Ordering::Relaxed);
        
        // Wait briefly for mixer to finish processing?
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // Finalize Writer
        {
            let mut guard = self.writer.lock().unwrap();
            if let Some(writer) = guard.take() {
                writer.finalize().map_err(|e| format!("Failed to finalize WAV: {:?}", e))?;
            }
        }
        
        // Clear mixer
        *self.mixer.lock().unwrap() = None;

        Ok(())
    }
}

struct ErrorHandler;
impl StreamErrorHandler for ErrorHandler {
    fn on_error(&self) {
        eprintln!("Stream error occurred");
    }
}

struct OutputWrapper {
    producer: Arc<Mutex<HeapProducer<f32>>>,
    paused: Arc<std::sync::atomic::AtomicBool>,
}

impl StreamOutput for OutputWrapper {
    fn did_output_sample_buffer(&self, sample: CMSampleBuffer, _of_type: SCStreamOutputType) {
        let CMSampleBuffer { sys_ref, .. } = sample;
        
        unsafe {
            use core_media_sys::CMSampleBufferRef;
            type CMBlockBufferRef = *mut std::ffi::c_void;
            
            #[link(name = "CoreMedia", kind = "framework")]
            extern "C" {
                fn CMSampleBufferGetDataBuffer(sbuf: CMSampleBufferRef) -> CMBlockBufferRef;
                fn CMBlockBufferGetDataPointer(
                    theBuffer: CMBlockBufferRef,
                    offset: usize,
                    lengthAtOffsetOut: *mut usize,
                    totalLengthOut: *mut usize,
                    dataPointerOut: *mut *mut u8
                ) -> i32;
            }
            
            let ptr: CMSampleBufferRef = std::mem::transmute_copy(&sys_ref);
            let block_buffer = CMSampleBufferGetDataBuffer(ptr);
            if block_buffer.is_null() { return; }
            
            let mut length_at_offset: usize = 0;
            let mut total_length: usize = 0;
            let mut data_ptr: *mut u8 = std::ptr::null_mut();
            
            let res = CMBlockBufferGetDataPointer(
                block_buffer,
                0,
                &mut length_at_offset,
                &mut total_length,
                &mut data_ptr
            );
            
            if res == 0 && !data_ptr.is_null() && total_length > 0 {
                let num_samples = total_length / std::mem::size_of::<f32>();
                let f32_ptr = data_ptr as *const f32;
                let samples = std::slice::from_raw_parts(f32_ptr, num_samples);
                
                if !self.paused.load(std::sync::atomic::Ordering::Relaxed) {
                    if let Ok(mut prod) = self.producer.lock() {
                        for &sample in samples {
                            let _ = prod.push(sample);
                        }
                    }
                }
            }
        }
    }
}
