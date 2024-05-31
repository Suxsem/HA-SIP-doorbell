// part of this code is from https://github.com/AlexxIT/WebRTC by Alexey Khit

import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';

@customElement('sip-doorbell-video')
export class SipDoorbellVideo extends LitElement {

    video: Ref<HTMLVideoElement> = createRef();

    @property()
    config: any;

    @property({ attribute: false })
    status?: string;

    @property({ attribute: false })
    standby = false;

    private _preventSleep = false;
    @property()
    set preventSleep(preventSleep:boolean) {
        this._preventSleep = preventSleep;
        if (!preventSleep) {
            this.setSleep();
        } else {
            this.standby = false;
        }
    }
    get preventSleep() { return this._preventSleep; }

    private _hass: any;
    @property()
    set hass(hass:any) {
        this._hass = hass;
    }
    get hass() { return this._hass; }

    @property()
    set muted(muted:boolean) {
        if (this.video.value) {
            this.video.value!.muted = muted;
        }
    }

    DISCONNECT_TIMEOUT = 1000;
    RECONNECT_TIMEOUT = 5000;
    SLEEP_TIMEOUT = 30000;
    CODECS = [
        'avc1.640029',      // H.264 high 4.1 (Chromecast 1st and 2nd Gen)
        'avc1.64002A',      // H.264 high 4.2 (Chromecast 3rd Gen)
        'avc1.640033',      // H.264 high 5.1 (Chromecast with Google TV)
        'hvc1.1.6.L153.B0', // H.265 main 5.1 (Chromecast Ultra)
        'mp4a.40.2',        // AAC LC
        'mp4a.40.5',        // AAC HE
        'flac',             // FLAC (PCM compatible)
        'opus',             // OPUS Chrome, Firefox
    ];

    wsState:number = WebSocket.CLOSED;
    ws?:WebSocket;
    connectTS = 0;
    mseCodecs = '';
    disconnectTID = 0;
    reconnectTID = 0;
    notVisible = false;
    onmessage:{ [id: string] : (msg: any) => void} = {};
    ondata?: (data: any) => void;
    initialized = false;
    sleepTimeout?:number = undefined;

    async connectedCallback() {

        super.connectedCallback();

        if (!this.config!.video_url && !this.config.video_entity) {
            throw new Error("Missing `video_url` or `video_entity`");
        }

        await this.updateComplete;
        
        if (this.disconnectTID) {
            clearTimeout(this.disconnectTID);
            this.disconnectTID = 0;
        }

        // because video autopause on disconnected from DOM
        if (this.initialized) {
            const seek = this.video.value!.seekable;
            if (seek.length > 0) {
                this.video.value!.currentTime = seek.end(seek.length - 1);
            }
            this.play();
        } else {
            this.init();
        }

        this.onconnect();
    }

    firstUpdated() {
        this.video.value!.addEventListener('enterpictureinpicture', () => {
            const event = new CustomEvent('pipchanged', {
                detail: true
            });
            this.dispatchEvent(event);
        });
        this.video.value!.addEventListener('leavepictureinpicture', () => {
            const event = new CustomEvent('pipchanged', {
                detail: false
            });
            this.dispatchEvent(event);
        });
    }

    disconnectedCallback() {
        if (this.config.video_background || this.disconnectTID) return;
        if (this.wsState === WebSocket.CLOSED) return;

        this.disconnectTID = setTimeout(() => {
            if (this.reconnectTID) {
                clearTimeout(this.reconnectTID);
                this.reconnectTID = 0;
            }

            this.disconnectTID = 0;

            this.ondisconnect();
        }, this.DISCONNECT_TIMEOUT);
    }

    init() {

        // all Safari lies about supported audio codecs
        const m = window.navigator.userAgent.match(/Version\/(\d+).+Safari/);
        if (m) {
            // AAC from v13, FLAC from v14, OPUS - unsupported
            const skip = m[1] < '13' ? 'mp4a.40.2' : m[1] < '14' ? 'flac' : 'opus';
            this.CODECS.splice(this.CODECS.indexOf(skip));
        }

        if (!this.config.video_background) {

            if ('hidden' in document) {
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        this.disconnectedCallback();
                    } else if (this.isConnected) {
                        this.connectedCallback();
                    }
                });
            }

            const visibilityThreshold = this.config.video_intersection === 0 ? 0 : this.config.video_intersection || 0.75;

            if ('IntersectionObserver' in window && visibilityThreshold) {
                const observer = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting && !this.notVisible) {
                            this.disconnectedCallback();
                        } else if (this.isConnected && this.notVisible) {
                            this.connectedCallback();
                        }
                        if (!entry.isIntersecting) {
                            this.notVisible = true;
                        } else {
                            this.notVisible = false;
                        }
                    });
                }, { threshold: visibilityThreshold });
                observer.observe(this);
            }
        }

        this.initialized = true;

    }

    async onconnect() {
        if (!this.isConnected || this.ws) return false;

        // CLOSED or CONNECTING => CONNECTING
        this.wsState = WebSocket.CONNECTING;

        this.connectTS = Date.now();

        this.status = "Connecting...";

        try {
            const wsUrl = await this.getWsUrl();
            if (!wsUrl) {
                return;
            }
            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';
            this.ws.addEventListener('open', () => this.onWsOpen());
            this.ws.addEventListener('close', () => this.onWsClose());
            
            this.status = "Loading...";

        } catch (err) {

            this.status = "WS error: " + err;

        }

    }

    ondisconnect() {
        this.wsState = WebSocket.CLOSED;
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }

        this.video.value!.src = '';
        this.video.value!.srcObject = null;
    }

    onWsOpen() {
        // CONNECTING => OPEN
        this.wsState = WebSocket.OPEN;

        this.ws!.addEventListener('message', ev => {
            if (typeof ev.data === 'string') {
                const msg = JSON.parse(ev.data);
                for (const mode in this.onmessage) {
                    this.onmessage[mode](msg);
                }
            } else {
                this.ondata?.(ev.data);
            }
        });

        this.ondata = undefined;
        this.onmessage = {};

        this.onmessage["stream"] = msg => {

            this.status = msg.type == "error" ? "Stream error: " + msg.value : "LIVE";

        }

        const modes = [];

        if ('MediaSource' in window || 'ManagedMediaSource' in window) {
            modes.push('mse');
            this.onmse();
        }

        return modes;
    }

    onWsClose() {
        if (this.wsState === WebSocket.CLOSED) return false;

        // CONNECTING, OPEN => CONNECTING
        this.wsState = WebSocket.CONNECTING;
        this.ws = undefined;

        // reconnect no more than once every X seconds
        const delay = Math.max(this.RECONNECT_TIMEOUT - (Date.now() - this.connectTS), 0);

        this.reconnectTID = setTimeout(() => {
            this.reconnectTID = 0;
            this.onconnect();
        }, delay);

        return true;
    }

    async getWsUrl() {

        try {
            const data = await this.hass.callWS({
                type: 'auth/sign_path', path: '/api/webrtc/ws'
            });

            let wsURL = 'ws' + this.hass.hassUrl(data.path).substring(4);

            if (this.config.video_entity) {
                wsURL += '&entity=' + this.config.video_entity;
            } else if (this.config.video_url) {
                wsURL += '&url=' + encodeURIComponent(this.config.video_url);
            }

            if (this.config.video_server) {
                wsURL += '&server=' + encodeURIComponent(this.config.video_server);
            }

            return wsURL;
        } catch (err) {

            this.status = "HASS error: " + err;

        }

    }

    onmse() {
        /** @type {MediaSource} */
        let ms : MediaSource;

        if ('ManagedMediaSource' in window) {
            const managedMediaSource = window.ManagedMediaSource as new () => MediaSource;

            ms = new managedMediaSource();
            ms.addEventListener('sourceopen', () => {
                this.send({ type: 'mse', value: this.codecs(MediaSource.isTypeSupported) });
            }, { once: true });

            this.video.value!.disableRemotePlayback = true;
            this.video.value!.srcObject = ms;
        } else {
            ms = new MediaSource();
            ms.addEventListener('sourceopen', () => {
                URL.revokeObjectURL(this.video.value!.src);
                this.send({ type: 'mse', value: this.codecs(MediaSource.isTypeSupported) });
            }, { once: true });

            this.video.value!.src = URL.createObjectURL(ms);
            this.video.value!.srcObject = null;
        }

        this.play();

        this.mseCodecs = '';

        this.onmessage['mse'] = msg => {
            if (msg.type !== 'mse') return;

            this.mseCodecs = msg.value;

            const sb = ms.addSourceBuffer(msg.value);
            sb.mode = 'segments'; // segments or sequence
            sb.addEventListener('updateend', () => {
                if (sb.updating) return;

                try {
                    if (bufLen > 0) {
                        const data = buf.slice(0, bufLen);
                        bufLen = 0;
                        sb.appendBuffer(data);
                    } else if (sb.buffered && sb.buffered.length) {
                        const end = sb.buffered.end(sb.buffered.length - 1) - 15;
                        const start = sb.buffered.start(0);
                        if (end > start) {
                            sb.remove(start, end);
                            ms.setLiveSeekableRange(end, end + 15);
                        }
                        // console.debug("VideoRTC.buffered", start, end);
                    }
                } catch (e) {
                    // console.debug(e);
                }
            });

            const buf = new Uint8Array(2 * 1024 * 1024);
            let bufLen = 0;

            this.ondata = data => {
                if (sb.updating || bufLen > 0) {
                    const b = new Uint8Array(data);
                    buf.set(b, bufLen);
                    bufLen += b.byteLength;
                    // console.debug("VideoRTC.buffer", b.byteLength, bufLen);
                } else {
                    try {
                        sb.appendBuffer(data);
                    } catch (e) {
                        // console.debug(e);
                    }
                }
            };
        };
    }
    
    play() {
        this.video.value!.play().catch((err) => {
            if (!this.video.value! && err.name === "NotAllowedError") {
                this.video.value!.muted = true;
                this.video.value!.play().catch(er => {
                    console.warn(er);
                });
            }
        });
        this.standby = false;
        this.setSleep();
    }

    codecs(isSupported:(type: string) => boolean) {
        return this.CODECS
            .filter(codec => isSupported(`video/mp4; codecs="${codec}"`)).join();
    }

    send(value:any) {
        if (this.ws) this.ws.send(JSON.stringify(value));
    }

    private setSleep() {
        if (this.sleepTimeout) {
            clearTimeout(this.sleepTimeout);
        }
        this.sleepTimeout = setTimeout(() => {
            if (!this.preventSleep) {
                this.standby = true;
                this.sleepTimeout = undefined;    
            }
        }, this.config.video_sleep_timeout || this.SLEEP_TIMEOUT);
    }

    private nudge() {
        if (!this.sleepTimeout) {
            this.standby = false;
        }
        this.setSleep();
    }

    static styles = css`
        :root {
            position: relative;
        }
        .player {
            background-color: black;
            height: 100%;
            width: 100%;
            position: absolute;
            background-color: black;
            margin: auto;
        }
        .player video {
            object-position: top;
            display: block;
            width: 100%;
            height: 100%;
        }
        .header {
            position: absolute;
            top: 6px;
            left: 10px;
            right: 10px;
            color: white;
            display: flex;
            justify-content: space-between;
            pointer-events: none;
            opacity: 0.6;
        }
        .standby-hint {
            position: absolute;
            color: white;
            pointer-events: none;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        }
    `;

    render() {

        return html`
            <div class="player" @click="${this.nudge}">
                <video
                    ${ref(this.video)}
                    style="display: ${this.standby ? 'none' : 'block'}"
                    playsinline
                    preload="auto"
                    muted>
                </video>
            </div>
            <div class="standby-hint"
                style="display: ${this.standby ? 'flex' : 'none'}">
                Standby. Tocca per riattivare
            </div>
            <div class="header">
                <div class="left"></div>
                <div class="right">${this.status}</div>
            </div>
        `;
    }

}