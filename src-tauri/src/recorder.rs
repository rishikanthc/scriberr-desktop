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
use ringbuf::HeapProducer;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

use crate::mixer::AudioMixer;

#[allow(dead_code)]
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
    mic_producer: Arc<Mutex<Option<Arc<Mutex<HeapProducer<f32>>>>>>,
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
            mic_producer: Arc::new(Mutex::new(None)),
        }
    }

    pub fn pause_recording(&self) {
        self.paused.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn resume_recording(&self) {
        self.paused.store(false, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn get_microphones() -> Vec<(String, String)> {
        let host = cpal::default_host();
        host.input_devices().map(|devices| {
            devices.filter_map(|d| {
                let name = d.name().unwrap_or("Unknown Device".to_string());
                // Use name as ID for now, or index if possible? 
                // cpal doesn't expose stable IDs easily across platforms.
                // Using name is risky if duplicates exist.
                // But for macOS, names are usually unique enough for UI.
                Some((name.clone(), name))
            }).collect()
        }).unwrap_or_default()
    }

    pub fn switch_microphone(&mut self, device_name: String) -> Result<(), String> {
        // Stop current mic stream
        self.mic_stream = None;

        let host = cpal::default_host();
        let device = host.input_devices().map_err(|e| e.to_string())?
            .find(|d| d.name().unwrap_or_default() == device_name)
            .ok_or("Device not found")?;

        let config = cpal::StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(48000),
            buffer_size: cpal::BufferSize::Default,
        };

        // Get the producer
        let producer_arc = {
            let guard = self.mic_producer.lock().unwrap();
            guard.clone().ok_or("Mixer not initialized")?
        };

        let mic_paused = self.paused.clone();
        
        let mic_stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                if !mic_paused.load(std::sync::atomic::Ordering::Relaxed) {
                    if let Ok(mut prod) = producer_arc.lock() {
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
        
        Ok(())
    }

    pub async fn start_recording(&mut self, pid: i32, output_path: PathBuf, mic_device_name: Option<String>) -> Result<(), String> {
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
        let sys_enabled = pid != -1;
        let mic_enabled = if let Some(ref device_name) = mic_device_name {
            device_name != "None"
        } else {
            false
        };

        let (mixer, sys_prod, mic_prod, running) = AudioMixer::new(writer_arc.clone(), sys_enabled, mic_enabled);
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

        // 3. Setup Microphone (if requested)
        if mic_enabled {
            if let Some(device_name) = mic_device_name {
                 let mic_prod_mutex = Arc::new(Mutex::new(mic_prod));
                *self.mic_producer.lock().unwrap() = Some(mic_prod_mutex.clone());

                let host = cpal::default_host();
                // Find device by name or default
                let device = if device_name == "Default" {
                    host.default_input_device()
                } else {
                    host.input_devices().map_err(|e| e.to_string())?
                        .find(|d| d.name().unwrap_or_default() == device_name)
                };

                if let Some(device) = device {
                     let config = cpal::StreamConfig {
                        channels: 2,
                        sample_rate: cpal::SampleRate(48000),
                        buffer_size: cpal::BufferSize::Default,
                    };

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
                    );

                    match mic_stream {
                        Ok(stream) => {
                            if let Ok(_) = stream.play() {
                                self.mic_stream = Some(SendStream(stream));
                            }
                        },
                        Err(e) => eprintln!("Failed to start mic: {:?}", e),
                    }
                } else {
                    eprintln!("Requested mic device not found: {}", device_name);
                }
            }
        }

        // 4. Setup System Audio (SCK) - Only if enabled
        if sys_enabled {
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
        }

        Ok(())
    }

    pub fn stop_recording(&mut self) -> Result<(), String> {
        // Stop Mic
        self.mic_stream = None; 

        // Stop System Audio
        if let Some(stream) = &self.stream {
            if let Err(e) = stream.stop_capture() {
                // Ignore "already stopped" error
                let msg = format!("{:?}", e);
                if !msg.contains("already stopped") && !msg.contains("does not exist") {
                     eprintln!("Warning: Failed to stop capture: {:?}", e);
                }
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
                fn CMSampleBufferGetFormatDescription(sbuf: CMSampleBufferRef) -> *mut std::ffi::c_void;
                fn CMAudioFormatDescriptionGetStreamBasicDescription(fmt_desc: *mut std::ffi::c_void) -> *const AudioStreamBasicDescription;
            }

            #[repr(C)]
            #[allow(non_snake_case)]
            struct AudioStreamBasicDescription {
                pub mSampleRate: f64,
                pub mFormatID: u32,
                pub mFormatFlags: u32,
                pub mBytesPerPacket: u32,
                pub mFramesPerPacket: u32,
                pub mBytesPerFrame: u32,
                pub mChannelsPerFrame: u32,
                pub mBitsPerChannel: u32,
                pub mReserved: u32,
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
                
                // Get Format Info
                let fmt_desc = CMSampleBufferGetFormatDescription(ptr);
                let asbd_ptr = CMAudioFormatDescriptionGetStreamBasicDescription(fmt_desc);
                
                let mut is_planar = false;
                let mut channels = 2;
                
                if !asbd_ptr.is_null() {
                    let asbd = &*asbd_ptr;
                    channels = asbd.mChannelsPerFrame as usize;
                    is_planar = (asbd.mFormatFlags & (1 << 5)) != 0; // kAudioFormatFlagIsNonInterleaved
                }

                if !self.paused.load(std::sync::atomic::Ordering::Relaxed) {
                    if let Ok(mut prod) = self.producer.lock() {
                        if is_planar && channels == 2 {
                            // Planar Stereo: [LLLL...][RRRR...]
                            // We need to interleave: L, R, L, R...
                            let num_frames = num_samples / 2;
                            let left = &samples[0..num_frames];
                            let right = &samples[num_frames..2*num_frames];
                            
                            for i in 0..num_frames {
                                let _ = prod.push(left[i]);
                                let _ = prod.push(right[i]);
                            }
                        } else if channels == 1 {
                            // Mono: [M, M, M...]
                            // Duplicate for Stereo: M, M, M, M...
                            for &sample in samples {
                                let _ = prod.push(sample);
                                let _ = prod.push(sample);
                            }
                        } else {
                            // Interleaved Stereo (or unknown), push as is
                            for &sample in samples {
                                let _ = prod.push(sample);
                            }
                        }
                    }
                }
            }
        }
    }
}
