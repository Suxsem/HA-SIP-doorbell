// part of this code is from https://github.com/TECH7Fox/sip-hass-card by Jordy Kuhne

import { UA, WebSocketInterface } from "jssip";
import { EndEvent, IceCandidateEvent, IncomingEvent, OutgoingEvent, PeerConnectionEvent, RTCSession } from "jssip/lib/RTCSession";
import { CallOptions, RTCSessionEvent, UAConfiguration } from "jssip/lib/UA";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from 'lit/directives/ref.js';

@customElement('sip-doorbell-phone')
export class SipDoorbellPhone extends LitElement {

    ua: UA;
    sipPhoneSession?: RTCSession;
    remoteAudioRef: Ref<HTMLAudioElement> = createRef();
    inCall = false;

    @property()
    config: any;

    @property()
    set micMuted(micMuted:boolean) {
        if (micMuted) {
            this.sipPhoneSession?.mute();
        } else {
            this.sipPhoneSession?.unmute();
        }
    }

    @property()
    set muted(muted:boolean) {
        if (this.remoteAudioRef.value) {
            this.remoteAudioRef.value!.muted = muted;
        }
    }

    constructor() {
        super();
        
        if (!this.config!.sip_ws) {
            throw new Error("Missing `sip_ws` eg. `wss://sip.mydomain.com:443/ws`");
        }
        if (!this.config!.sip_domain) {
            throw new Error("Missing `sip_domain` eg. `sip.mydomain.com`");
        }
        if (!this.config!.sip_ext) {
            throw new Error("Missing `sip_ext` eg. `8003`");
        }
        if (!this.config!.sip_user) {
            throw new Error("Missing `sip_user` eg. `8003`");
        }
        if (!this.config!.sip_password) {
            throw new Error("Missing `sip_password` eg. `abc`");
        }
        if (!this.config!.turn_user) {
            throw new Error("Missing `turn_user` eg. `user`");
        }
        if (!this.config!.turn_password) {
            throw new Error("Missing `turn_password` eg. `psw`");
        }

        const socket = new WebSocketInterface(this.config.sip_ws);
        const configuration: UAConfiguration = {
            sockets: [socket],
            uri: "sip: " + this.config.sip_ext + "@" + this.config.sip_domain,
            authorization_user: this.config.sip_user,
            password: this.config.sip_password,
            register: true,
            register_expires: 30
        };

        this.ua = new UA(configuration);
        this.ua.on('newRTCSession', this.newRTCSession);

    }

    async connectedCallback() {
        super.connectedCallback();
        console.log("sip-doorbell-phone connectedCallback")

        await this.updateComplete;

        this.ua.on('connected', (e) => {
            console.log("sip-doorbell-phone connected")
            const event = new CustomEvent('wsconnected', {
                detail: true
            });
            this.dispatchEvent(event);
        });

        this.ua.on('disconnected', (e) => {
            console.log("sip-doorbell-phone disconnected: ");
            console.log(e);
            const event = new CustomEvent('wsconnected', {
                detail: false
            });
            this.dispatchEvent(event);
        });

        if (!this.ua.isConnected()) {
            this.ua.start();
        }
    }

    newRTCSession = (event: RTCSessionEvent) => {
        if (this.sipPhoneSession != undefined) {
            event.session.terminate();
            return;
        }

        console.log('Call: newRTCSession: Originator: ' + event.originator);

        this.sipPhoneSession = event.session;

        this.sipPhoneSession.on('getusermediafailed', function (DOMError) {
            console.log('getUserMedia() failed: ' + DOMError);
        });

        this.sipPhoneSession.on('peerconnection:createofferfailed', function (DOMError) {
            console.log('createOffer() failed: ' + DOMError);
        });

        this.sipPhoneSession.on('peerconnection:createanswerfailed', function (DOMError) {
            console.log('createAnswer() failed: ' + DOMError);
        });

        this.sipPhoneSession.on('peerconnection:setlocaldescriptionfailed', function (DOMError) {
            console.log('setLocalDescription() failed: ' + DOMError);
        });

        this.sipPhoneSession.on('peerconnection:setremotedescriptionfailed', function (DOMError) {
            console.log('setRemoteDescription() failed: ' + DOMError);
        });

        this.sipPhoneSession.on("confirmed", (event: IncomingEvent | OutgoingEvent) => {
            console.log('Call confirmed. Originator: ' + event.originator);
        });

        this.sipPhoneSession.on("failed", (event: EndEvent) => {
            console.log('Call failed. Originator: ' + event.originator);
            this.inCall = false;
            const event1 = new CustomEvent('loadingcall', {
                detail: false
            });
            this.dispatchEvent(event1);
            const event2 = new CustomEvent('talking', {
                detail: false
            });
            this.dispatchEvent(event2);
            this.sipPhoneSession = undefined;
        });

        this.sipPhoneSession.on("ended", (event: EndEvent) => {
            console.log('Call ended. Originator: ' + event.originator);
            this.inCall = false;
            const event1 = new CustomEvent('loadingcall', {
                detail: false
            });
            this.dispatchEvent(event1);
            const event2 = new CustomEvent('talking', {
                detail: false
            });
            this.dispatchEvent(event2);
            this.sipPhoneSession = undefined;
        });

        this.sipPhoneSession.on("accepted", (event: IncomingEvent | OutgoingEvent) => {
            console.log('Call accepted. Originator: ' + event.originator);
        });

        let iceCandidateTimeout: number;
        const iceTimeout = 0.5;
        const iceLongTimeout = 5;

        let stunCandidateOk = false;
        let turnCandidateOk = false;

        this.sipPhoneSession.on("icecandidate", (event: IceCandidateEvent) => {
            console.log('ICE: candidate: ' + event.candidate.candidate);

            if (event.candidate.type == "prflx" || event.candidate.type == "srflx") {
                stunCandidateOk = true;
            } else if (event.candidate.type == "relay") {
                turnCandidateOk = true;
            }

            if (iceCandidateTimeout != null) {
                clearTimeout(iceCandidateTimeout);
            }

            iceCandidateTimeout = setTimeout(() => {
                console.log('ICE: stop candidate gathering due to application timeout.');
                event.ready();
            }, (stunCandidateOk && turnCandidateOk ? iceTimeout : iceLongTimeout) * 1000);
        });

        let handleIceGatheringStateChangeEvent = (event: any): void => {
            let connection = event.target;

            console.log('ICE: gathering state changed: ' + connection.iceGatheringState);

            if (connection.iceGatheringState === 'complete') {
                console.log('ICE: candidate gathering complete. Cancelling ICE application timeout timer...');
                if (iceCandidateTimeout != null) {
                    clearTimeout(iceCandidateTimeout);
                }
            }
        };

        let handleRemoteTrackEvent = async (event: RTCTrackEvent): Promise<void> => {
            console.log('Call: peerconnection: mediatrack event: kind: ' + event.track.kind);

            let stream: MediaStream | null = null;
            if (event.streams) {
                console.log('Call: peerconnection: mediatrack event: number of associated streams: ' + event.streams.length + ' - using first stream');
                stream = event.streams[0];
            }
            else {
                console.log('Call: peerconnection: mediatrack event: no associated stream. Creating stream...');
                if (!stream) {
                    stream = new MediaStream();
                }
                stream.addTrack(event.track);
            }

            const remoteAudio = this.remoteAudioRef.value!;
            if (event.track.kind === 'audio' && remoteAudio.srcObject != stream) {
                remoteAudio.srcObject = stream;
                try {
                    await remoteAudio.play();
                }
                catch (err) {
                    console.log('Error starting audio playback: ' + err);
                }
            }

        }

        if (this.sipPhoneSession.direction === 'incoming') {

            this.sipPhoneSession.on("peerconnection", (event: PeerConnectionEvent) => {
                console.log('Call: peerconnection(incoming)');

                event.peerconnection.addEventListener("track", handleRemoteTrackEvent);
                event.peerconnection.addEventListener("icegatheringstatechange", handleIceGatheringStateChangeEvent);
            });

        }
        else if (this.sipPhoneSession.direction === 'outgoing') {
            //Note: peerconnection seems to never fire for outgoing calls
            this.sipPhoneSession.on("peerconnection", (event: PeerConnectionEvent) => {
                console.log('Call: peerconnection(outgoing)');
            });

            this.sipPhoneSession.connection.addEventListener("track", handleRemoteTrackEvent);
            this.sipPhoneSession.connection.addEventListener("icegatheringstatechange", handleIceGatheringStateChangeEvent);
        }
        else {
            console.log('Call: direction was neither incoming or outgoing!');
        }
    }

    public makeCall(extension: string) {
        const event1 = new CustomEvent('loadingcall', {
            detail: true
        });
        this.dispatchEvent(event1);
        this.inCall = true;

        const iceConfig = {
            "iceCandidatePoolSize": 0,
            "iceTransportPolicy": "all",
            "iceServers": [
                {
                    "urls": "stun:stun.relay.metered.ca:80"
                },
                {
                    "urls": "turn:standard.relay.metered.ca:80",
                    "username": this.config.turn_user,
                    "credential": this.config.turn_password
                },
            ],
            "rtcpMuxPolicy": "require"
        };

        var eventHandlers = {
            'progress': (e: any) => {
                console.log('call is in progress');
            },
            'failed': (e: any) => {
                console.log('call failed with cause: ' + e.cause);
            },
            'ended': (e: any) => {
                console.log('call ended with cause: ' + e.cause);
            },
            'confirmed': (e: any) => {
                console.log('call confirmed');
            }
        };

        const options: CallOptions = {
            eventHandlers: eventHandlers,
            mediaConstraints: { audio: true, video: false },
            rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
            rtcAnswerConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
            rtcConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
            pcConfig: iceConfig as RTCConfiguration
        };

        this.ua.call("sip:" + extension + "@" + this.config.sip_domain, options);
    }

    public endCall() {
        this.ua.terminateSessions();
    }

    audioEvent(e: Event) {
        if (this.remoteAudioRef.value && this.remoteAudioRef.value!.currentTime > 0 && this.inCall) {
            const event1 = new CustomEvent('loadingcall', {
                detail: false
            });
            this.dispatchEvent(event1);
            const event2 = new CustomEvent('talking', {
                detail: true
            });
            this.dispatchEvent(event2);
        }
    }

    static styles = css`
        :root {
            position: relative;
        }
    `;

    render() {
        return html`
            <audio ${ref(this.remoteAudioRef)} style="display: hidden" @timeupdate="${this.audioEvent}"></audio>
        `;
    }

}