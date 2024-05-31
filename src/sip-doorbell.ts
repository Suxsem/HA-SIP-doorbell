import {
    LitElement,
    css,
    html,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import "./sip-doorbell-video";
import "./sip-doorbell-phone"
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { SipDoorbellPhone } from "./sip-doorbell-phone";
import { SipDoorbellVideo } from "./sip-doorbell-video";

@customElement('sip-doorbell')
class SipDoorbell extends LitElement {

    config: any;
    phoneRef: Ref<SipDoorbellPhone> = createRef();
    videoRef: Ref<SipDoorbellVideo> = createRef();
    autocallDone = false;

    @property({ attribute: false })
    statoCitofono = "";

    @property({ attribute: false })
    statoChiamata = "";

    @property({ attribute: false })
    wsconnected = false;

    @property({ attribute: false })
    loadingcall = false;

    @property({ attribute: false })
    talking = false;

    @property({ attribute: false })
    fullScreen = !!document.fullscreenElement;

    @property({ attribute: false })
    pictureInPicture = false;

    @property({ attribute: false })
    micMuted = false;

    @property({ attribute: false })
    videoMuted = true;

    @property({ attribute: false })
    phoneMuted = false;

    private _hass: any;
    @property()
    set hass(hass: any) {
        this._hass = hass;
        this.statoCitofono = hass?.states?.["input_select.stato_citofono"]?.state;
        this.statoChiamata = hass?.states?.["input_select.stato_chiamata_citofono"]?.state;
    }
    get hass() { return this._hass; }

    setConfig(config: any) {
        this.config = config;
    }

    firstUpdated() {
        super.connectedCallback();

        this.addEventListener('fullscreenchange', () => {
            this.fullScreen = !!document.fullscreenElement;
        });
    }

    private pipChanged(e: CustomEvent) {
        if (e.detail) {
            this.pictureInPicture = true;
        } else {
            this.pictureInPicture = false;
            this.videoRef.value!.video.value!.play();
        }
    }

    private toggleFullScreen() {
        if (this.fullScreen) {
            document.exitFullscreen();
        } else {
            this.requestFullscreen();
        }
    }
    private togglePictureInPicture() {
        if (this.pictureInPicture) {
            document.exitPictureInPicture();
        } else {
            this.videoRef.value!.video.value!.requestPictureInPicture();
        }
    }
    
    private toggleMic() {
        this.micMuted = !this.micMuted;
    }
    private toggleMuted() {
        if (this.talking) {
            this.phoneMuted = !this.phoneMuted;
        } else {
            this.videoMuted = !this.videoMuted;
        }
    }

    private saveScreenshot() {
        const a = document.createElement('a');

        if (this.videoRef.value!.video.value!.videoWidth && this.videoRef.value!.video.value!.videoHeight) {
            const canvas = document.createElement('canvas');
            canvas.width = this.videoRef.value!.video.value!.videoWidth;
            canvas.height = this.videoRef.value!.video.value!.videoHeight;
            canvas.getContext('2d')?.drawImage(this.videoRef.value!.video.value!, 0, 0, canvas.width, canvas.height);
            a.href = canvas.toDataURL('image/jpeg');
        } else {
            return;
        }

        const ts = new Date().toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '');
        a.download = `snapshot_${ts}.jpeg`;
        a.click();
    }

    private callIncoming() {
        this.micMuted = false;
        this.phoneMuted = false;
        this.videoMuted = true;
        this.phoneRef.value?.makeCall("555");
        this.setHassInComunicazione();
    }
    private callOutgoing() {
        this.micMuted = false;
        this.phoneMuted = false;
        this.videoMuted = true;
        this.phoneRef.value?.makeCall("8001");
        this.setHassInComunicazione();
    }
    private hangup() {
        this.phoneRef.value?.endCall();
    }

    setHassInComunicazione() {
        this.hass.callService("input_select", "select_option", {
            entity_id: "input_select.stato_chiamata_citofono",
            option: "In comunicazione"
        });
    }

    private openDoor() {
        this.hass.callService("shell_command", "door_open", {});
    }

    private autoCall() {
        if (this.autocallDone) {
            return;
        }
        var urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.get('autocall')) {
            return;
        }
        let callback;
        if (!this.talking && this.statoChiamata == 'Inattivo') {
            callback = this.callOutgoing;
        } else if (!this.talking && this.statoChiamata == 'In attesa') {
            callback = this.callIncoming;
        }
        if (callback) {
            this.autocallDone = true;
            callback.call(this);
        }
    }

    static styles = css`
        ha-card {
            width: 100%;
            height: 100%;
        }
        :root {
            position: relative;
        }
        .stato {
            position: absolute;
            top: 6px;
            left: 10px;
            right: 10px;
            color: white;
            opacity: 0.6;
        }
        .controls {
            position: absolute;
            left: 5px;
            right: 5px;
            bottom: 5px;
            display: flex;
            opacity: 70%;
        }
        .button {
            --control-button-icon-color: white;
            --control-button-background-color: var(--primary-color);
            --control-button-background-opacity: 0.7;
            --control-button-border-radius: 18px;
            margin: 5px;
            flex-grow: 1;
            height: 60px;
        }
        .button-green {
            --control-button-background-color: green;
        }
        .button-red {
            --control-button-background-color: red;
        }
        .btn-icon {
            max-height: 100%;
            --mdc-icon-size: 100%;
        }
        .loading {
            --md-circular-progress-size: 36px !important;
        }
    `;

    render() {

        const loading = !this.wsconnected || this.loadingcall;

        let icon = html``;
        let callback;

        if (loading) {
            icon = html`<ha-circular-progress class="loading" indeterminate role="presentation"></ha-circular-progress>`;
        } else if (this.talking) {
            icon = html`<ha-icon class="btn-icon" icon="mdi:phone-hangup"></ha-icon>`;
            callback = this.hangup;
        } else if (this.statoChiamata == 'Inattivo') {
            icon = html`<ha-icon class="btn-icon" icon="mdi:phone-outgoing"></ha-icon>`;
            callback = this.callOutgoing;
        } else if (this.statoChiamata == 'In attesa') {
            icon = html`<ha-icon class="btn-icon" icon="mdi:phone-incoming"></ha-icon>`;
            callback = this.callIncoming;
        } else {
            icon = html`<ha-icon class="btn-icon" icon="mdi:phone-cancel"></ha-icon>`;
        }

        let isMuted = false;
        if (this.talking) {
            isMuted = this.phoneMuted;
        } else {
            isMuted = this.videoMuted;
        }

        return html`<ha-card ispanel class="card">
            <sip-doorbell-video ${ref(this.videoRef)}
                @pipchanged=${this.pipChanged}
                hass=${this.hass}
                config=${this.config}
                preventSleep=${this.talking || !this.videoMuted}
                muted=${this.videoMuted}
            ></sip-doorbell-video>
            <div class="stato">
                Stato citofono: ${this.statoCitofono}<br/>
                Stato chiamata: ${this.statoChiamata}
            </div>
            <div class="controls">
                <ha-control-button class="button" @click="${this.toggleFullScreen}">
                    <ha-icon class="btn-icon" icon="${this.fullScreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'}"></ha-icon>
                </ha-control-button>
                <ha-control-button class="button" @click="${this.togglePictureInPicture}">
                    <ha-icon class="btn-icon" icon="${this.pictureInPicture ? 'mdi:rectangle' : 'mdi:picture-in-picture-bottom-right'}"></ha-icon>
                </ha-control-button>
                <ha-control-button class="button" @click="${this.saveScreenshot}">
                    <ha-icon class="btn-icon" icon="mdi:floppy"></ha-icon>
                </ha-control-button>
                <ha-control-button
                    class="button
                        ${(this.statoChiamata == 'Inattivo' || this.statoChiamata == 'In attesa') && !this.talking ? css`button-green` : css``}
                        ${this.talking ? css`button-red` : css``}"
                    @click="${callback}"
                    ?disabled=${loading || (this.statoChiamata == 'In comunicazione' && !this.talking)}>
                    ${icon}
                </ha-control-button>
                <ha-control-button class="button" ?disabled=${!this.talking} @click="${this.toggleMic}">
                    <ha-icon class="btn-icon" icon="${this.micMuted && this.talking ? 'mdi:microphone-off' : 'mdi:microphone'}" icon=""></ha-icon>
                </ha-control-button>
                <ha-control-button class="button" @click="${this.toggleMuted}">
                    <ha-icon class="btn-icon" icon="${isMuted ? 'mdi:volume-variant-off' : 'mdi:volume-high'}"></ha-icon>
                </ha-control-button>
                <ha-control-button class="button" @click="${this.openDoor}">
                    <ha-icon class="btn-icon" icon="mdi:door-open"></ha-icon>
                </ha-control-button>
            </div>
            <sip-doorbell-phone ${ref(this.phoneRef)}
                config=${this.config}
                @wsconnected=${(e: CustomEvent) => { this.wsconnected = e.detail; this.autoCall() }}
                @loadingcall=${(e: CustomEvent) => { this.loadingcall = e.detail }}
                @talking=${(e: CustomEvent) => { this.talking = e.detail }}
                micMuted=${this.micMuted}
                muted=${this.phoneMuted}
            ></sip-doorbell-phone>
        </ha-card>`;
    }

}

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: "sip-doorbell",
    name: "SIP Doorbell",
    preview: false,
    description: "A SIP doorbell card"
});
