import protooClient from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';
import Logger from './Logger';
import * as e2e from './e2e';
import EventEmitter from 'eventemitter3';

export const ROOM_STATE_EVENT = "room_state";

export const NEW_PEER_EVENT = "new_peer";
export const PEER_CLOSED_EVENT = "peer_closed";

export const ADD_PRODUCER_EVENT = "add_producer";
export const REMOVE_PRODUCER_EVENT = "remove_producer";
export const PRODUCER_PAUSED_EVENT = "producer_paused";
export const PRODUCER_RESUMED_EVENT = "producer_paused";
export const REPLACE_PRODUCER_TRACK_EVENT = "replace_producer_track";

export const ADD_CONSUMER_EVENT = "new_consumer";
export const CONSUMER_CLOSED_EVENT = "consumer_closed";
export const CONSUMER_PAUSED_EVENT = "consumer_paused";
export const CONSUMER_RESUMED_EVENT = "consumer_resumed";

export const ACTIVE_SPEAKER_EVENT = "active_speaker";
export const DATA_CONSUMER_CLOSED_EVENT = "data_consumer_closed";

const VIDEO_CONSTRAINS =
{
	qvga : { width: { ideal: 320 }, height: { ideal: 240 } },
	vga  : { width: { ideal: 640 }, height: { ideal: 480 } },
	hd   : { width: { ideal: 1280 }, height: { ideal: 720 } }
};

const PC_PROPRIETARY_CONSTRAINTS =
{
	optional : [ { googDscp: true } ]
};

// Used for simulcast webcam video.
const WEBCAM_SIMULCAST_ENCODINGS =
[
	{ scaleResolutionDownBy: 4, maxBitrate: 500000 },
	{ scaleResolutionDownBy: 2, maxBitrate: 1000000 },
	{ scaleResolutionDownBy: 1, maxBitrate: 5000000 }
];

// Used for VP9 webcam video.
const WEBCAM_KSVC_ENCODINGS =
[
	{ scalabilityMode: 'S3T3_KEY' }
];

// Used for simulcast screen sharing.
const SCREEN_SHARING_SIMULCAST_ENCODINGS =
[
	{ dtx: true, maxBitrate: 1500000 },
	{ dtx: true, maxBitrate: 6000000 }
];

// Used for VP9 screen sharing.
const SCREEN_SHARING_SVC_ENCODINGS =
[
	{ scalabilityMode: 'S3T3', dtx: true }
];

const EXTERNAL_VIDEO_SRC = '/resources/videos/video-audio-stereo.mp4';

const logger = new Logger('RoomClient');

export default class RoomClient extends EventEmitter
{
	constructor(
		{
			roomId,
			peerId,
			displayName,
			device,
			protooUrl,
			handlerName,
			useSimulcast,
			useSharingSimulcast,
			forceTcp,
			produce,
			consume,
			forceH264,
			forceVP9,
			svc,
			datachannel,
			externalVideo,
			e2eKey,
			hack
		}
	)
	{
		super();
		logger.debug(
			'constructor() [roomId:"%s", peerId:"%s", displayName:"%s", device:%s]',
			roomId, peerId, displayName, device.flag);

		// Closed flag.
		// @type {Boolean}
		this._closed = false;

		// Display name.
		// @type {String}
		this._displayName = displayName;

		// Device info.
		// @type {Object}
		this._device = device;

		// Whether we want to force RTC over TCP.
		// @type {Boolean}
		this._forceTcp = forceTcp;

		// Whether we want to produce audio/video.
		// @type {Boolean}
		this._produce = produce;

		// Whether we should consume.
		// @type {Boolean}
		this._consume = consume;

		// Whether we want DataChannels.
		// @type {Boolean}
		this._useDataChannel = datachannel;

		// Force H264 codec for sending.
		this._forceH264 = Boolean(forceH264);

		// Force VP9 codec for sending.
		this._forceVP9 = Boolean(forceVP9);

		// External video.
		// @type {HTMLVideoElement}
		this._externalVideo = null;

		// Enabled end-to-end encryption.
		this._e2eKey = e2eKey;

		// MediaStream of the external video.
		// @type {MediaStream}
		this._externalVideoStream = null;

		// Next expected dataChannel test number.
		// @type {Number}
		this._nextDataChannelTestNumber = 0;

		this._hack = hack;

		this._me = { 
			id                   : peerId, 
			displayName          : displayName, 
			device               : device,
			displayNameSet       : false,
			canSendMic           : true,
			canSendWebcam        : true,
			canChangeWebcam      : true,
			webcamInProgress     : false,
			audioOnly            : false,
			audioOnlyInProgress  : false,
			restartIceInProgress : false
		};

		if (externalVideo)
		{
			this._externalVideo = document.createElement('video');

			this._externalVideo.controls = true;
			this._externalVideo.muted = true;
			this._externalVideo.loop = true;
			this._externalVideo.setAttribute('playsinline', '');
			this._externalVideo.src = EXTERNAL_VIDEO_SRC;

			this._externalVideo.play()
				.catch((error) => logger.warn('externalVideo.play() failed:%o', error));
		}

		// Custom mediasoup-client handler name (to override default browser
		// detection if desired).
		// @type {String}
		this._handlerName = handlerName;

		// Whether simulcast should be used.
		// @type {Boolean}
		this._useSimulcast = useSimulcast;

		// Whether simulcast should be used in desktop sharing.
		// @type {Boolean}
		this._useSharingSimulcast = useSharingSimulcast;

		// Protoo URL.
		// @type {String}
		this._protooUrl = protooUrl

		// protoo-client Peer instance.
		// @type {protooClient.Peer}
		this._protoo = null;

		// mediasoup-client Device instance.
		// @type {mediasoupClient.Device}
		this._mediasoupDevice = null;

		// mediasoup Transport for sending.
		// @type {mediasoupClient.Transport}
		this._sendTransport = null;

		// mediasoup Transport for receiving.
		// @type {mediasoupClient.Transport}
		this._recvTransport = null;

		// Local mic mediasoup Producer.
		// @type {mediasoupClient.Producer}
		this._micProducer = null;

		// Local webcam mediasoup Producer.
		// @type {mediasoupClient.Producer}
		this._webcamProducer = null;

		// Local share mediasoup Producer.
		// @type {mediasoupClient.Producer}
		this._shareProducer = null;

		// mediasoup Consumers.
		// @type {Map<String, mediasoupClient.Consumer>}
		this._consumers = new Map();

		// mediasoup DataConsumers.
		// @type {Map<String, mediasoupClient.DataConsumer>}
		this._dataConsumers = new Map();

		// Map of webcam MediaDeviceInfos indexed by deviceId.
		// @type {Map<String, MediaDeviceInfos>}
		this._webcams = new Map();

		// Local Webcam.
		// @type {Object} with:
		// - {MediaDeviceInfo} [device]
		// - {String} [resolution] - 'qvga' / 'vga' / 'hd'.
		this._webcam =
		{
			device     : null,
			resolution : 'hd'
		};

		this._state = "new";// new/connecting/connected/disconnected/closed,

		// Set custom SVC scalability mode.
		if (svc)
		{
			WEBCAM_KSVC_ENCODINGS[0].scalabilityMode = `${svc}_KEY`;
			SCREEN_SHARING_SVC_ENCODINGS[0].scalabilityMode = svc;
		}

		if (this._e2eKey && e2e.isSupported())
		{
			e2e.setCryptoKey('setCryptoKey', this._e2eKey, true);
		}
	}


	get state() 
	{
		return this._state;
	}

	close()
	{
		if (this._closed)
			return;

		if (this._state == "new") {
			return;
		}

		this._closed = true;

		logger.debug('close()');

		// Close protoo Peer
		this._protoo.close();

		// Close mediasoup Transports.
		if (this._sendTransport)
			this._sendTransport.close();

		if (this._recvTransport)
			this._recvTransport.close();

		this._state = 'closed';
		this.emit(ROOM_STATE_EVENT, this._state);
	}

	async join()
	{
		this._state = "connecting";
		this.emit(ROOM_STATE_EVENT, this._state);

		const protooTransport = new protooClient.WebSocketTransport(this._protooUrl);

		this._protoo = new protooClient.Peer(protooTransport);

		this._protoo.on('open', () => this._joinRoom());

		this._protoo.on('failed', () =>
		{

		});

		this._protoo.on('disconnected', () =>
		{
			logger.debug("on protoo disconnected");
			// Close mediasoup Transports.
			if (this._sendTransport)
			{
				this._sendTransport.close();
				this._sendTransport = null;
			}

			if (this._recvTransport)
			{
				this._recvTransport.close();
				this._recvTransport = null;
			}

			this._state = 'closed';
			this.emit(ROOM_STATE_EVENT, this._state);
		});

		this._protoo.on('close', () =>
		{
			logger.debug("on protoo close");
			if (this._closed)
				return;

			this.close();
		});

		// eslint-disable-next-line no-unused-vars
		this._protoo.on('request', async (request, accept, reject) =>
		{
			logger.debug(
				'proto "request" event [method:%s, data:%o]',
				request.method, request.data);
		});

		this._protoo.on('notification', (notification) =>
		{
			logger.debug(
				'proto "notification" event [method:%s, data:%o]',
				notification.method, notification.data);

			switch (notification.method)
			{
				case 'producerScore':
				{
					const { producerId, score } = notification.data;

					break;
				}

				case 'newProducer':
				{
					const { id, kind, peerId } = notification.data;

					logger.debug("new Producer:", id, kind, peerId);
					this._consumeProducer({ 
						producerId : id, 
						peerId     : peerId
					});
					break;
				}

				case 'newDataProducer':
				{
					break;
				}

				case 'newPeer':
				{
					const peer = notification.data;

					this.emit(NEW_PEER_EVENT, { ...peer, consumers: [], dataConsumers: [] });
					break;
				}

				case 'peerClosed':
				{
					const { peerId } = notification.data;

					this.emit(PEER_CLOSED_EVENT, peerId);
					break;
				}

				case 'peerDisplayNameChanged':
				{
					const { peerId, displayName, oldDisplayName } = notification.data;

					break;
				}

				case 'downlinkBwe':
				{
					logger.debug('\'downlinkBwe\' event:%o', notification.data);

					break;
				}

				case 'consumerClosed':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					consumer.close();
					this._consumers.delete(consumerId);

					const { peerId } = consumer.appData;

					this.emit(CONSUMER_CLOSED_EVENT, consumerId, peerId);

					break;
				}

				case 'consumerPaused':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					consumer.pause();

					const { peerId } = consumer.appData;

					this.emit(CONSUMER_PAUSED_EVENT, consumerId, peerId, 'remote');

					break;
				}

				case 'consumerResumed':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					consumer.resume();

					const { peerId } = consumer.appData;

					this.emit(CONSUMER_RESUMED_EVENT, consumerId, peerId, 'remote');

					break;
				}

				case 'consumerLayersChanged':
				{
					const { consumerId, spatialLayer, temporalLayer } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					break;
				}

				case 'consumerScore':
				{
					const { consumerId, score } = notification.data;

					break;
				}

				case 'dataConsumerClosed':
				{
					const { dataConsumerId } = notification.data;
					const dataConsumer = this._dataConsumers.get(dataConsumerId);

					if (!dataConsumer)
						break;

					dataConsumer.close();
					this._dataConsumers.delete(dataConsumerId);

					const { peerId } = dataConsumer.appData;

					this.emit(DATA_CONSUMER_CLOSED_EVENT, dataConsumerId);

					break;
				}

				case 'activeSpeaker':
				{
					const { peerId } = notification.data;

					this.emit(ACTIVE_SPEAKER_EVENT, peerId);

					break;
				}

				default:
				{
					logger.error(
						'unknown protoo notification.method "%s"', notification.method);
				}
			}
		});
	}

	async enableMic()
	{
		logger.debug('enableMic()');

		if (this._micProducer)
			return;

		if (!this._mediasoupDevice.canProduce('audio'))
		{
			logger.error('enableMic() | cannot produce audio');

			return;
		}

		let track;

		try
		{
			if (!this._externalVideo)
			{
				logger.debug('enableMic() | calling getUserMedia()');

				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

				track = stream.getAudioTracks()[0];
			}
			else
			{
				const stream = await this._getExternalVideoStream();

				track = stream.getAudioTracks()[0].clone();
			}

			this._micProducer = await this._sendTransport.produce(
				{
					track,
					codecOptions :
					{
						opusStereo : 1,
						opusDtx    : 1
					}
					// NOTE: for testing codec selection.
					// codec : this._mediasoupDevice.rtpCapabilities.codecs
					// 	.find((codec) => codec.mimeType.toLowerCase() === 'audio/pcma')
				});

			if (this._e2eKey && e2e.isSupported())
			{
				e2e.setupSenderTransform(this._micProducer.rtpSender);
			}

			this.emit(ADD_PRODUCER_EVENT, {
				id            : this._micProducer.id,
				paused        : this._micProducer.paused,
				track         : this._micProducer.track,
				rtpParameters : this._micProducer.rtpParameters,
				codec         : this._micProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
			});

			this._micProducer.on('transportclose', () =>
			{
				this._micProducer = null;
			});

			this._micProducer.on('trackended', () =>
			{
				this.disableMic()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableMic() | failed:%o', error);
			if (track)
				track.stop();
		}
	}

	async disableMic()
	{
		logger.debug('disableMic()');

		if (!this._micProducer)
			return;

		this._micProducer.close();

		this.emit(REMOVE_PRODUCER_EVENT, this._micProducer.id);

		try
		{
			await this._protoo.request(
				'closeProducer', { producerId: this._micProducer.id });
		}
		catch (error)
		{
		
		}

		this._micProducer = null;
	}

	async muteMic()
	{
		logger.debug('muteMic()');

		this._micProducer.pause();

		try
		{
			await this._protoo.request(
				'pauseProducer', { producerId: this._micProducer.id });

			this.emit(PRODUCER_PAUSED_EVENT, this._micProducer.id);
		}
		catch (error)
		{
			logger.error('muteMic() | failed: %o', error);
		}
	}

	async unmuteMic()
	{
		logger.debug('unmuteMic()');

		this._micProducer.resume();

		try
		{
			await this._protoo.request(
				'resumeProducer', { producerId: this._micProducer.id });

			this.emit(PRODUCER_RESUMED_EVENT, this._micProducer.id);
		}
		catch (error)
		{
			logger.error('unmuteMic() | failed: %o', error);
		}
	}

	async enableWebcam()
	{
		logger.debug('enableWebcam()');

		if (this._webcamProducer)
			return;
		else if (this._shareProducer)
			await this.disableShare();

		if (!this._mediasoupDevice.canProduce('video'))
		{
			logger.error('enableWebcam() | cannot produce video');

			return;
		}

		let track;
		let device;

		try
		{
			if (!this._externalVideo)
			{
				await this._updateWebcams();
				device = this._webcam.device;

				const { resolution } = this._webcam;

				if (!device)
					throw new Error('no webcam devices');

				logger.debug('enableWebcam() | calling getUserMedia()');

				const stream = await navigator.mediaDevices.getUserMedia(
					{
						video :
						{
							deviceId : { ideal: device.deviceId },
							...VIDEO_CONSTRAINS[resolution]
						}
					});

				track = stream.getVideoTracks()[0];
			}
			else
			{
				device = { label: 'external video' };

				const stream = await this._getExternalVideoStream();

				track = stream.getVideoTracks()[0].clone();
			}

			let encodings;
			let codec;
			const codecOptions =
			{
				videoGoogleStartBitrate : 1000
			};

			if (this._forceH264)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/h264');

				if (!codec)
				{
					throw new Error('desired H264 codec+configuration is not supported');
				}
			}
			else if (this._forceVP9)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/vp9');

				if (!codec)
				{
					throw new Error('desired VP9 codec+configuration is not supported');
				}
			}

			if (this._useSimulcast)
			{
				// If VP9 is the only available video codec then use SVC.
				const firstVideoCodec = this._mediasoupDevice
					.rtpCapabilities
					.codecs
					.find((c) => c.kind === 'video');

				if (
					(this._forceVP9 && codec) ||
					firstVideoCodec.mimeType.toLowerCase() === 'video/vp9'
				)
				{
					encodings = WEBCAM_KSVC_ENCODINGS;
				}
				else
				{
					encodings = WEBCAM_SIMULCAST_ENCODINGS;
				}
			}

			this._webcamProducer = await this._sendTransport.produce(
				{
					track,
					encodings,
					codecOptions,
					codec
				});

			if (this._e2eKey && e2e.isSupported())
			{
				e2e.setupSenderTransform(this._webcamProducer.rtpSender);
			}

			this.emit(ADD_PRODUCER_EVENT, {
				id            : this._webcamProducer.id,
				deviceLabel   : device.label,
				type          : this._getWebcamType(device),
				paused        : this._webcamProducer.paused,
				track         : this._webcamProducer.track,
				rtpParameters : this._webcamProducer.rtpParameters,
				codec         : this._webcamProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
			});

			this._webcamProducer.on('transportclose', () =>
			{
				this._webcamProducer = null;
			});

			this._webcamProducer.on('trackended', () =>
			{
				this.disableWebcam()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableWebcam() | failed:%o', error);

			if (track)
				track.stop();
		}

	}

	async disableWebcam()
	{
		logger.debug('disableWebcam()');

		if (!this._webcamProducer)
			return;

		this._webcamProducer.close();

		this.emit(REMOVE_PRODUCER_EVENT, this._webcamProducer.id);
		try
		{
			await this._protoo.request(
				'closeProducer', { producerId: this._webcamProducer.id });
		}
		catch (error)
		{
	
		}

		this._webcamProducer = null;
	}

	async changeWebcam()
	{
		logger.debug('changeWebcam()');

		try
		{
			await this._updateWebcams();

			const array = Array.from(this._webcams.keys());
			const len = array.length;
			const deviceId =
				this._webcam.device ? this._webcam.device.deviceId : undefined;
			let idx = array.indexOf(deviceId);

			if (idx < len - 1)
				idx++;
			else
				idx = 0;

			this._webcam.device = this._webcams.get(array[idx]);

			logger.debug(
				'changeWebcam() | new selected webcam [device:%o]',
				this._webcam.device);

			// Reset video resolution to HD.
			this._webcam.resolution = 'hd';

			if (!this._webcam.device)
				throw new Error('no webcam devices');

			// Closing the current video track before asking for a new one (mobiles do not like
			// having both front/back cameras open at the same time).
			this._webcamProducer.track.stop();

			logger.debug('changeWebcam() | calling getUserMedia()');

			const stream = await navigator.mediaDevices.getUserMedia(
				{
					video :
					{
						deviceId : { exact: this._webcam.device.deviceId },
						...VIDEO_CONSTRAINS[this._webcam.resolution]
					}
				});

			const track = stream.getVideoTracks()[0];

			await this._webcamProducer.replaceTrack({ track });

			this.emit(REPLACE_PRODUCER_TRACK_EVENT, this._webcamProducer.id, track);
		}
		catch (error)
		{
			logger.error('changeWebcam() | failed: %o', error);
		}
	}

	async changeWebcamResolution()
	{
		logger.debug('changeWebcamResolution()');

		try
		{
			switch (this._webcam.resolution)
			{
				case 'qvga':
					this._webcam.resolution = 'vga';
					break;
				case 'vga':
					this._webcam.resolution = 'hd';
					break;
				case 'hd':
					this._webcam.resolution = 'qvga';
					break;
				default:
					this._webcam.resolution = 'hd';
			}

			logger.debug('changeWebcamResolution() | calling getUserMedia()');

			const stream = await navigator.mediaDevices.getUserMedia(
				{
					video :
					{
						deviceId : { exact: this._webcam.device.deviceId },
						...VIDEO_CONSTRAINS[this._webcam.resolution]
					}
				});

			const track = stream.getVideoTracks()[0];

			await this._webcamProducer.replaceTrack({ track });

			this.emit(REPLACE_PRODUCER_TRACK_EVENT, this._webcamProducer.id, track);

		}
		catch (error)
		{
			logger.error('changeWebcamResolution() | failed: %o', error);
		}
	}

	async enableShare()
	{
		logger.debug('enableShare()');

		if (this._shareProducer)
			return;
		else if (this._webcamProducer)
			await this.disableWebcam();

		if (!this._mediasoupDevice.canProduce('video'))
		{
			logger.error('enableShare() | cannot produce video');

			return;
		}

		let track;

		try
		{
			logger.debug('enableShare() | calling getUserMedia()');

			const stream = await navigator.mediaDevices.getDisplayMedia(
				{
					audio : false,
					video :
					{
						displaySurface : 'monitor',
						logicalSurface : true,
						cursor         : true,
						width          : { max: 1920 },
						height         : { max: 1080 },
						frameRate      : { max: 30 }
					}
				});

			// May mean cancelled (in some implementations).
			if (!stream)
			{
				return;
			}

			track = stream.getVideoTracks()[0];

			let encodings;
			let codec;
			const codecOptions =
			{
				videoGoogleStartBitrate : 1000
			};

			if (this._forceH264)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/h264');

				if (!codec)
				{
					throw new Error('desired H264 codec+configuration is not supported');
				}
			}
			else if (this._forceVP9)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/vp9');

				if (!codec)
				{
					throw new Error('desired VP9 codec+configuration is not supported');
				}
			}

			if (this._useSharingSimulcast)
			{
				// If VP9 is the only available video codec then use SVC.
				const firstVideoCodec = this._mediasoupDevice
					.rtpCapabilities
					.codecs
					.find((c) => c.kind === 'video');

				if (
					(this._forceVP9 && codec) ||
					firstVideoCodec.mimeType.toLowerCase() === 'video/vp9'
				)
				{
					encodings = SCREEN_SHARING_SVC_ENCODINGS;
				}
				else
				{
					encodings = SCREEN_SHARING_SIMULCAST_ENCODINGS
						.map((encoding) => ({ ...encoding, dtx: true }));
				}
			}

			this._shareProducer = await this._sendTransport.produce(
				{
					track,
					encodings,
					codecOptions,
					codec,
					appData :
					{
						share : true
					}
				});

			if (this._e2eKey && e2e.isSupported())
			{
				e2e.setupSenderTransform(this._shareProducer.rtpSender);
			}

			this.emit(ADD_PRODUCER_EVENT, {
				id            : this._shareProducer.id,
				type          : 'share',
				paused        : this._shareProducer.paused,
				track         : this._shareProducer.track,
				rtpParameters : this._shareProducer.rtpParameters,
				codec         : this._shareProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
			});

			this._shareProducer.on('transportclose', () =>
			{
				this._shareProducer = null;
			});

			this._shareProducer.on('trackended', () =>
			{
				this.disableShare()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableShare() | failed:%o', error);
			if (track)
				track.stop();
		}
	}

	async disableShare()
	{
		logger.debug('disableShare()');

		if (!this._shareProducer)
			return;

		this._shareProducer.close();

		this.emit(REMOVE_PRODUCER_EVENT, this._shareProducer.id);

		try
		{
			await this._protoo.request(
				'closeProducer', { producerId: this._shareProducer.id });
		}
		catch (error)
		{
	
		}

		this._shareProducer = null;
	}

	async enableAudioOnly()
	{
		logger.debug('enableAudioOnly()');
		this.disableWebcam();

		for (const consumer of this._consumers.values())
		{
			if (consumer.kind !== 'video')
				continue;

			this._pauseConsumer(consumer);
		}
	}

	async disableAudioOnly()
	{
		logger.debug('disableAudioOnly()');

		if (!this._webcamProducer && this._produce)
		{
			this.enableWebcam();
		}

		for (const consumer of this._consumers.values())
		{
			if (consumer.kind !== 'video')
				continue;

			this._resumeConsumer(consumer);
		}

	}

	async muteAudio()
	{
		logger.debug('muteAudio()');
	}

	async unmuteAudio()
	{
		logger.debug('unmuteAudio()');
	}

	async restartIce()
	{
		logger.debug('restartIce()');
		try
		{
			if (this._sendTransport)
			{
				const iceParameters = await this._protoo.request(
					'restartIce',
					{ transportId: this._sendTransport.id });

				await this._sendTransport.restartIce({ iceParameters });
			}

			if (this._recvTransport)
			{
				const iceParameters = await this._protoo.request(
					'restartIce',
					{ transportId: this._recvTransport.id });

				await this._recvTransport.restartIce({ iceParameters });
			}
		}
		catch (error)
		{
			logger.error('restartIce() | failed:%o', error);
		}
	}

	async setMaxSendingSpatialLayer(spatialLayer)
	{
		logger.debug('setMaxSendingSpatialLayer() [spatialLayer:%s]', spatialLayer);

		try
		{
			if (this._webcamProducer)
				await this._webcamProducer.setMaxSpatialLayer(spatialLayer);
			else if (this._shareProducer)
				await this._shareProducer.setMaxSpatialLayer(spatialLayer);
		}
		catch (error)
		{
			logger.error('setMaxSendingSpatialLayer() | failed:%o', error);
		}
	}

	async setConsumerPreferredLayers(consumerId, spatialLayer, temporalLayer)
	{
		logger.debug(
			'setConsumerPreferredLayers() [consumerId:%s, spatialLayer:%s, temporalLayer:%s]',
			consumerId, spatialLayer, temporalLayer);
		try
		{
			await this._protoo.request(
				'setConsumerPreferredLayers', { consumerId, spatialLayer, temporalLayer });
		}
		catch (error)
		{
			logger.error('setConsumerPreferredLayers() | failed:%o', error);
		}
	}

	async setConsumerPriority(consumerId, priority)
	{
		logger.debug(
			'setConsumerPriority() [consumerId:%s, priority:%d]',
			consumerId, priority);

		try
		{
			await this._protoo.request('setConsumerPriority', { consumerId, priority });
		}
		catch (error)
		{
			logger.error('setConsumerPriority() | failed:%o', error);
		}
	}

	async requestConsumerKeyFrame(consumerId)
	{
		logger.debug('requestConsumerKeyFrame() [consumerId:%s]', consumerId);

		try
		{
			await this._protoo.request('requestConsumerKeyFrame', { consumerId });

		}
		catch (error)
		{
			logger.error('requestConsumerKeyFrame() | failed:%o', error);
		}
	}

	async getSendTransportRemoteStats()
	{
		logger.debug('getSendTransportRemoteStats()');

		if (!this._sendTransport)
			return;

		return this._protoo.request(
			'getTransportStats', { transportId: this._sendTransport.id });
	}

	async getRecvTransportRemoteStats()
	{
		logger.debug('getRecvTransportRemoteStats()');

		if (!this._recvTransport)
			return;

		return this._protoo.request(
			'getTransportStats', { transportId: this._recvTransport.id });
	}

	async getAudioRemoteStats()
	{
		logger.debug('getAudioRemoteStats()');

		if (!this._micProducer)
			return;

		return this._protoo.request(
			'getProducerStats', { producerId: this._micProducer.id });
	}

	async getVideoRemoteStats()
	{
		logger.debug('getVideoRemoteStats()');

		const producer = this._webcamProducer || this._shareProducer;

		if (!producer)
			return;

		return this._protoo.request(
			'getProducerStats', { producerId: producer.id });
	}

	async getConsumerRemoteStats(consumerId)
	{
		logger.debug('getConsumerRemoteStats()');

		const consumer = this._consumers.get(consumerId);

		if (!consumer)
			return;

		return this._protoo.request('getConsumerStats', { consumerId });
	}

	async getChatDataProducerRemoteStats()
	{
		logger.debug('getChatDataProducerRemoteStats()');

		const dataProducer = this._chatDataProducer;

		if (!dataProducer)
			return;

		return this._protoo.request(
			'getDataProducerStats', { dataProducerId: dataProducer.id });
	}

	async getBotDataProducerRemoteStats()
	{
		logger.debug('getBotDataProducerRemoteStats()');

		const dataProducer = this._botDataProducer;

		if (!dataProducer)
			return;

		return this._protoo.request(
			'getDataProducerStats', { dataProducerId: dataProducer.id });
	}

	async getDataConsumerRemoteStats(dataConsumerId)
	{
		logger.debug('getDataConsumerRemoteStats()');

		const dataConsumer = this._dataConsumers.get(dataConsumerId);

		if (!dataConsumer)
			return;

		return this._protoo.request('getDataConsumerStats', { dataConsumerId });
	}

	async getSendTransportLocalStats()
	{
		logger.debug('getSendTransportLocalStats()');

		if (!this._sendTransport)
			return;

		return this._sendTransport.getStats();
	}

	async getRecvTransportLocalStats()
	{
		logger.debug('getRecvTransportLocalStats()');

		if (!this._recvTransport)
			return;

		return this._recvTransport.getStats();
	}

	async getAudioLocalStats()
	{
		logger.debug('getAudioLocalStats()');

		if (!this._micProducer)
			return;

		return this._micProducer.getStats();
	}

	async getVideoLocalStats()
	{
		logger.debug('getVideoLocalStats()');

		const producer = this._webcamProducer || this._shareProducer;

		if (!producer)
			return;

		return producer.getStats();
	}

	async getConsumerLocalStats(consumerId)
	{
		const consumer = this._consumers.get(consumerId);

		if (!consumer)
			return;

		return consumer.getStats();
	}

	async applyNetworkThrottle({ uplink, downlink, rtt, secret })
	{
		logger.debug(
			'applyNetworkThrottle() [uplink:%s, downlink:%s, rtt:%s]',
			uplink, downlink, rtt);

		try
		{
			await this._protoo.request(
				'applyNetworkThrottle',
				{ uplink, downlink, rtt, secret });
		}
		catch (error)
		{
			logger.error('applyNetworkThrottle() | failed:%o', error);
		}
	}

	async resetNetworkThrottle({ silent = false, secret })
	{
		logger.debug('resetNetworkThrottle()');

		try
		{
			await this._protoo.request('resetNetworkThrottle', { secret });
		}
		catch (error)
		{
			if (!silent)
			{
				logger.error('resetNetworkThrottle() | failed:%o', error);
			}
		}
	}

	async _joinRoom()
	{
		logger.debug('_joinRoom()');

		try
		{
			this._mediasoupDevice = new mediasoupClient.Device(
				{
					handlerName : this._handlerName
				});

			const routerRtpCapabilities =
				await this._protoo.request('getRouterRtpCapabilities');

			await this._mediasoupDevice.load({ routerRtpCapabilities });

			// NOTE: Stuff to play remote audios due to browsers' new autoplay policy.
			//
			// Just get access to the mic and DO NOT close the mic track for a while.
			// Super hack!
			if (this._hack)
			{
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const audioTrack = stream.getAudioTracks()[0];

				audioTrack.enabled = false;

				setTimeout(() => audioTrack.stop(), 120000);
			}
			// Create mediasoup Transport for sending (unless we don't want to produce).
			if (this._produce)
			{
				const transportInfo = await this._protoo.request(
					'createWebRtcTransport',
					{
						forceTcp         : this._forceTcp,
						producing        : true,
						consuming        : false,
						sctpCapabilities : this._useDataChannel
							? this._mediasoupDevice.sctpCapabilities
							: undefined
					});

				const {
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters,
					sctpParameters
				} = transportInfo;

				this._sendTransport = this._mediasoupDevice.createSendTransport(
					{
						id,
						iceParameters,
						iceCandidates,
						dtlsParameters,
						sctpParameters,
						iceServers             : [],
						proprietaryConstraints : PC_PROPRIETARY_CONSTRAINTS,
						additionalSettings 	   :
							{ encodedInsertableStreams: this._e2eKey && e2e.isSupported() }
					});

				this._sendTransport.on(
					'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
					{
						this._protoo.request(
							'connectWebRtcTransport',
							{
								transportId : this._sendTransport.id,
								dtlsParameters
							})
							.then(callback)
							.catch(errback);
					});

				this._sendTransport.on(
					'produce', async ({ kind, rtpParameters, appData }, callback, errback) =>
					{
						try
						{
							// eslint-disable-next-line no-shadow
							const { id } = await this._protoo.request(
								'produce',
								{
									transportId : this._sendTransport.id,
									kind,
									rtpParameters,
									appData
								});

							callback({ id });
						}
						catch (error)
						{
							errback(error);
						}
					});

				this._sendTransport.on('producedata', async (
					{
						sctpStreamParameters,
						label,
						protocol,
						appData
					},
					callback,
					errback
				) =>
				{
					logger.debug(
						'"producedata" event: [sctpStreamParameters:%o, appData:%o]',
						sctpStreamParameters, appData);

					try
					{
						// eslint-disable-next-line no-shadow
						const { id } = await this._protoo.request(
							'produceData',
							{
								transportId : this._sendTransport.id,
								sctpStreamParameters,
								label,
								protocol,
								appData
							});

						callback({ id });
					}
					catch (error)
					{
						errback(error);
					}
				});
			}

			// Create mediasoup Transport for receiving (unless we don't want to consume).
			if (this._consume)
			{
				const transportInfo = await this._protoo.request(
					'createWebRtcTransport',
					{
						forceTcp         : this._forceTcp,
						producing        : false,
						consuming        : true,
						sctpCapabilities : this._useDataChannel
							? this._mediasoupDevice.sctpCapabilities
							: undefined
					});

				const {
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters,
					sctpParameters
				} = transportInfo;

				this._recvTransport = this._mediasoupDevice.createRecvTransport(
					{
						id,
						iceParameters,
						iceCandidates,
						dtlsParameters,
						sctpParameters,
						iceServers 	       : [],
						additionalSettings :
							{ encodedInsertableStreams: this._e2eKey && e2e.isSupported() }
					});

				this._recvTransport.on(
					'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
					{
						this._protoo.request(
							'connectWebRtcTransport',
							{
								transportId : this._recvTransport.id,
								dtlsParameters
							})
							.then(callback)
							.catch(errback);
					});
			}

			// Join now into the room.
			// NOTE: Don't send our RTP capabilities if we don't want to consume.
			const { peers } = await this._protoo.request(
				'join',
				{
					displayName     : this._displayName,
					device          : this._device,
					rtpCapabilities : this._consume
						? this._mediasoupDevice.rtpCapabilities
						: undefined,
					sctpCapabilities : this._useDataChannel && this._consume
						? this._mediasoupDevice.sctpCapabilities
						: undefined
				});
			
			this._state = "connected";
			this.emit(ROOM_STATE_EVENT, this._state);

			for (const peer of peers)
			{
				const p = { 
					id            : peer.id, 
					displayName   : peer.displayName, 
					device        : peer.device,
					consumers     : [], 
					dataConsumers : [] 
				};
	
				this.emit(NEW_PEER_EVENT, p);

				peer.producers.forEach((producer) =>
				{
					this._consumeProducer({ producerId : producer.id, peerId : peer.id });
				});
			}

			// Enable mic/webcam.
			if (this._produce)
			{
				// Set our media capabilities.
				this._me.canSendMic = this._mediasoupDevice.canProduce('audio');
				this._me.canSendWebcam = this._mediasoupDevice.canProduce('video');

				this.enableMic();
				this.enableWebcam();

				this._sendTransport.on('connectionstatechange', (connectionState) =>
				{
					logger.debug("send transport connection state:", connectionState);
				});
			}
		}
		catch (error)
		{
			logger.error('_joinRoom() failed:%o', error);
			this.close();
		}
	}

	async _consumeProducer({ producerId, peerId }) 
	{
		const transportId = this._recvTransport.id;

		const {
			id,
			kind,
			rtpParameters,
			type,
			producerPaused
		} = await this._protoo.request(
			'consume', {
				producerId,
				transportId
			});

		console.log("new consumer:", id, kind);
		try 
		{
			const consumer = await this._recvTransport.consume({
				id,
				producerId,
				kind,
				rtpParameters,
				appData : {
					peerId
				} // Trick.
			});

			if (this._e2eKey && e2e.isSupported()) 
			{
				e2e.setupReceiverTransform(consumer.rtpReceiver);
			}

			// Store in the map.
			this._consumers.set(consumer.id, consumer);

			consumer.on('transportclose', () => 
			{
				this._consumers.delete(consumer.id);
			});

			const {
				spatialLayers,
				temporalLayers
			} =
			mediasoupClient.parseScalabilityMode(
				consumer.rtpParameters.encodings[0].scalabilityMode);

			await this._protoo.request(
				'resumeConsumer', {
					consumerId : consumer.id
				});

			this.emit(ADD_CONSUMER_EVENT, {
				id                     : consumer.id,
				type                   : type,
				locallyPaused          : false,
				remotelyPaused         : producerPaused,
				rtpParameters          : consumer.rtpParameters,
				spatialLayers          : spatialLayers,
				temporalLayers         : temporalLayers,
				preferredSpatialLayer  : spatialLayers - 1,
				preferredTemporalLayer : temporalLayers - 1,
				priority               : 1,
				codec                  : consumer.rtpParameters.codecs[0].mimeType.split('/')[1],
				track                  : consumer.track,
				paused                 : false
			}, peerId);

			// If audio-only mode is enabled, pause it.
			/*
			if (consumer.kind === 'video')
				this._pauseConsumer(consumer);*/
		} 
		catch (error) 
		{
			logger.error('"newConsumer" request failed:%o', error);
			throw error;
		}
	}

	async _updateWebcams()
	{
		logger.debug('_updateWebcams()');

		// Reset the list.
		this._webcams = new Map();

		logger.debug('_updateWebcams() | calling enumerateDevices()');

		const devices = await navigator.mediaDevices.enumerateDevices();

		for (const device of devices)
		{
			if (device.kind !== 'videoinput')
				continue;

			this._webcams.set(device.deviceId, device);
		}

		const array = Array.from(this._webcams.values());
		const len = array.length;
		const currentWebcamId =
			this._webcam.device ? this._webcam.device.deviceId : undefined;

		logger.debug('_updateWebcams() [webcams:%o]', array);

		if (len === 0)
			this._webcam.device = null;
		else if (!this._webcams.has(currentWebcamId))
			this._webcam.device = array[0];
	}

	_getWebcamType(device)
	{
		if (/(back|rear)/i.test(device.label))
		{
			logger.debug('_getWebcamType() | it seems to be a back camera');

			return 'back';
		}
		else
		{
			logger.debug('_getWebcamType() | it seems to be a front camera');

			return 'front';
		}
	}

	async _pauseConsumer(consumer)
	{
		if (consumer.paused)
			return;

		try
		{
			await this._protoo.request('pauseConsumer', { consumerId: consumer.id });

			consumer.pause();

			this.emit(CONSUMER_PAUSED_EVENT, consumer.id, "local");
		}
		catch (error)
		{
			logger.error('_pauseConsumer() | failed:%o', error);
		}
	}

	async _resumeConsumer(consumer)
	{
		if (!consumer.paused)
			return;

		try
		{
			await this._protoo.request('resumeConsumer', { consumerId: consumer.id });

			consumer.resume();

			this.emit(CONSUMER_RESUMED_EVENT, consumer.id, "local");

		}
		catch (error)
		{
			logger.error('_resumeConsumer() | failed:%o', error);
		}
	}

	async _getExternalVideoStream()
	{
		if (this._externalVideoStream)
			return this._externalVideoStream;

		if (this._externalVideo.readyState < 3)
		{
			await new Promise((resolve) => (
				this._externalVideo.addEventListener('canplay', resolve)
			));
		}

		if (this._externalVideo.captureStream)
			this._externalVideoStream = this._externalVideo.captureStream();
		else if (this._externalVideo.mozCaptureStream)
			this._externalVideoStream = this._externalVideo.mozCaptureStream();
		else
			throw new Error('video.captureStream() not supported');

		return this._externalVideoStream;
	}
}
