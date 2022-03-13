import { Web } from "sip.js/lib/index.js";
import {
  LitElement,
  html,
  css,
  unsafeCSS
} from "lit";
import "./editor";
import { customElement } from "lit/decorators.js";

@customElement('sipjs-card')
class SipJsCard extends LitElement {
    simpleUser: any;
    user: any;
    config: any;
    hass: any;
    timerElement: any;
    renderRoot: any;
    popup: boolean = false;
    currentCamera: any;
    intervalId!: number;

    static get properties() {
        return {
            hass: {},
            config: {},
            popup: {
                type: Boolean
            },
            timerElement: {},
            currentCamera: {}
        };
    }

    static get styles() {
        return css `
            .wrapper {
                padding: 8px;
                padding-top: 0px;
                padding-bottom: 2px;
            }
            .flex {
                flex: 1;
                margin-top: 6px;
                margin-bottom: 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-width: 0;
            }
            .info, .info > * {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .info {
                flex: 1 1 30%;
                cursor: pointer;
                margin-left: 16px;
                margin-right: 8px;
            }
            ha-card {
                cursor: pointer;
            }
            .good {
                color: var(--label-badge-green);
            }
            .warning {
                color: var(--label-badge-yellow);
            }
            .critical {
                color: var(--label-badge-red);
            }
            .icon {
                padding: 0px 18px 0px 8px;
              }
            #phone .content {
                color: white;
            }
            video {
                display: block;
                height: auto;
                width: 90vw;
                background-color: #2b2b2b;
            }
            .box {
                position: absolute;
                /* start paper-font-common-nowrap style */
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                /* end paper-font-common-nowrap style */
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(
                  --ha-picture-card-background-color,
                  rgba(0, 0, 0, 0.3)
                );
                padding: 4px 8px;
                font-size: 16px;
                line-height: 40px;
                color: var(--ha-picture-card-text-color, white);
                display: flex;
                justify-content: space-between;
                flex-direction: row;
            }
            .box .title {
                font-weight: 500;
                margin-left: 8px;
            }
            .row {
                display: flex;
                flex-direction: row;
            }
            .container {
                transition: filter 0.2s linear 0s;
                width: 80vw;
            }
            .box, ha-icon {
                display: flex;
                align-items: center;
            }
            .accept-btn {
                color: var(--label-badge-green);
            }
            .hangup-btn {
                color: var(--label-badge-red);
            }
            #time, .title {
                margin-right: 8px;
                display: flex;
                align-items: center;
            }
            .extension {
                color: gray;
            }
            ha-camera-stream {
                height: auto;
                width: 100%;
                display: block;
            }

            .mdc-dialog__surface {
                position: relative;
                display: flex;
                flex-direction: column;
                flex-grow: 0;
                flex-shrink: 0;
                box-sizing: border-box;
                max-width: 100%;
                max-height: 100%;
                pointer-events: auto;
                overflow-y: auto;
            }

            .mdc-dialog__container {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-around;
                box-sizing: border-box;
                height: 100%;
                transform: scale(0.8);
                opacity: 0;
                pointer-events: none;
            }

            ha-dialog[data-domain="camera"] {
                --dialog-content-padding: 0;
            }
            
            @media (min-width: 451px) and (min-height: 501px) {
                ha-dialog {
                    --mdc-dialog-max-width: 90vw !important;
                }
                ha-dialog[data-domain="camera"] .content, ha-dialog[data-domain="camera"] ha-header-bar {
                    width: auto;
                }
            }

            @media all and (max-width: 450px), all and (max-height: 500px) {
                ha-dialog {
                  --mdc-dialog-min-width: calc(
                    100vw - env(safe-area-inset-right) - env(safe-area-inset-left)
                  );
                  --mdc-dialog-max-width: calc(
                    100vw - env(safe-area-inset-right) - env(safe-area-inset-left)
                  );
                  --mdc-dialog-min-height: 100%;
                  --mdc-dialog-max-height: 100%;
                  --mdc-shape-medium: 0px;
                  --vertial-align-dialog: flex-end;
                }
                video {
                    width: 100vw;
                    margin-top: 50%;
                    transform: translateY(50%);
                }
            }

            ha-dialog {
                --dialog-surface-position: static;
                /* --dialog-content-position: static; */
            }

            ha-dialog {
                --mdc-dialog-min-width: 400px;
                --mdc-dialog-max-width: 600px;
                --mdc-dialog-heading-ink-color: var(--primary-text-color);
                --mdc-dialog-content-ink-color: var(--primary-text-color);
                --justify-action-buttons: space-between;
            }
        `;
    }

    closePopup() {
        this.popup = false;
    }

    openPopup() {
        this.popup = false;
        super.performUpdate();
        this.popup = true;
    }

    // allow-exoplayer

    render() {
        return html`
            <style>
                ha-icon-button {
                    --mdc-icon-button-size: ${this.config.button_size ? unsafeCSS(this.config.button_size) : css`48`}px;
                    --mdc-icon-size: ${this.config.button_size ? unsafeCSS(this.config.button_size - 25) : css`23`}px;
                }
            </style>
            <ha-dialog id="phone" ?open=${this.popup} hideactions data-domain="camera">
                <div slot="heading" class="heading">
                    <ha-header-bar>
                        <ha-icon-button slot="navigationIcon" dialogaction="cancel"></ha-icon-button>
                        <div slot="title" class="main-title" title="Call">Call</div>
                        <ha-icon-button slot="actionItems"></ha-icon-button>
                    </ha-header-bar>
                </div>
                <div class="content">
                    ${this.currentCamera !== undefined ? html`
                        <ha-camera-stream
                            allow-exoplayer
                            muted
                            .hass=${this.hass}
                            .stateObj=${this.hass.states[this.currentCamera]}
                        ></ha-camera-stream>
                    ` : html`
                        <video id="remoteVideo"></video>
                    `}
                    <audio id="remoteAudio" style="display:none"></audio>
                    <audio id="toneAudio" style="display:none" loop controls></audio>
                    <div class="box">
                        <div class="row">
                            <ha-icon-button 
                                class="accept-btn"
                                .label=${"Accept Call"}
                                @click="${this._answer}"
                                ><ha-icon icon="hass:phone"></ha-icon>
                            </ha-icon-button>
                            <span id="name" class="title">Idle</span>
                        </div>
                        <div class="row">
                            <ha-icon-button
                                .label=${"Mute"}
                                @click="${this._toggleMute}"
                                ><ha-icon id="mute-icon" icon="hass:microphone"></ha-icon>
                            </ha-icon-button>
                        </div>
                        <div class="row">
                            ${this.config.dtmfs ?  
                                this.config.dtmfs.map((dtmf: { signal: any; name: any; icon: any; }) => {
                                    return html `
                                        <ha-icon-button 
                                            @click="${() => this._sendDTMF(dtmf.signal)}"
                                            .label="${dtmf.name}"
                                            ><ha-icon icon="${dtmf.icon}"></ha-icon>
                                        </ha-icon-button>
                                    `;
                                }) : ""
                            }
                            ${this.config.buttons ?  
                                this.config.buttons.map((button: { entity: any; name: any; icon: any; }) => {
                                    return html `
                                        <ha-icon-button 
                                            @click="${() => this._button(button.entity)}"
                                            .label="${button.name}"
                                            ><ha-icon icon="${button.icon}"></ha-icon>
                                        </ha-icon-button>
                                    `;
                                }) : ""
                            }
                        </div>
                        <div class="row">
                            <span id="time">00:00</span>
                            <ha-icon-button 
                                class="hangup-btn"
                                .label=${"Decline Call"}
                                @click="${this._hangup}"
                            ><ha-icon icon="hass:phone-hangup"></ha-icon>
                            </ha-icon-button>
                        </div>
                    </div>
                </div>
            </ha-dialog>
            
            <ha-card @click="${this.openPopup}">
                <h1 class="card-header">
                    <span id="title" class="name">Unknown person</span>
                    <span id="extension" class="extension">Offline</span>
                </h1>
                <div class="wrapper">

                    ${this.config.extensions.map((extension: { entity: string | number; person: string | number; icon: any; name: any; extension: any; camera: any; }) => {
                        var stateObj = this.hass.states[extension.entity];
                        var isMe = (this.hass.user.id == this.hass.states[extension.person].attributes.user_id);
                        if (isMe) {
                            this.user = extension;
                        }
                        if (!(isMe && this.config.hide_me)) {
                            return html`
                                <div class="flex">
                                    <state-badge
                                        .stateObj=${stateObj}
                                        .overrideIcon=${extension.icon}
                                        .stateColor=${this.config.state_color}
                                    ></state-badge>
                                    <div class="info">${extension.name}</div>
                                    <mwc-button @click="${() => this._call(extension.extension, extension.camera)}">CALL</mwc-button>
                                </div>
                            `;
                        }
                    })}

                    ${this.config.custom ?
                        this.config.custom.map((custom: { entity: string | number; icon: any; name: any; number: any; camera: any; }) => {
                            var stateObj = this.hass.states[custom.entity];
                            return html`
                                <div class="flex">
                                    <state-badge
                                        .stateObj=${stateObj}
                                        .overrideIcon=${custom.icon}
                                        .stateColor=${this.config.state_color}
                                    ></state-badge>
                                    <div class="info">${custom.name}</div>
                                    <mwc-button @click="${() => this._call(custom.number, custom.camera)}">CALL</mwc-button>
                                </div>
                            `;
                        }) : ""
                    }
              
                </div>
            </ha-card>
        `;
    }

    firstUpdated() {
        this.popup = false;
        this.currentCamera = undefined;
        this.connect();
    }

    setConfig(config: { server: any; port: any; extensions: any; }): void {
        if (!config.server) {
            throw new Error("You need to define a server!");
        }
        if (!config.port) {
            throw new Error("You need to define a port!");
        }
        if (!config.extensions) {
            throw new Error("You need to define at least one extension!");
        }
        this.config = config;
    }

    static async getConfigElement() {
        return document.createElement("sipjs-card-editor");
    }

    static getStubConfig() {
        return {
            server: "192.168.178.0.1",
            port: "8089",
            button_size: "48",
            custom: [
                {
                    name: 'Custom1',
                    number: '123',
                    icon: 'mdi:phone-classic'
                }
            ],
            dtmfs: [
                {
                    name: 'dtmf1',
                    signal: 1,
                    icon: 'mdi:door'
                }
            ]
        };
    }

    getCardSize() {
        return this.config.extensions.length + 1;
    }

    private ring(tone: string) {
        var toneAudio = this.renderRoot.querySelector('#toneAudio');
        if (this.config[tone]) {
            toneAudio.src = this.config[tone];
            toneAudio.currentTime = 0;
            toneAudio.play();
        } else {
            toneAudio.pause();
        }
    }

    private setName(text: string) {
        this.renderRoot.querySelector('#name').innerHTML = text;
    }

    private setTitle(text: any) {
        this.renderRoot.querySelector('#title').innerHTML = text;
    }

    private setExtension(text: any) {
        this.renderRoot.querySelector('#extension').innerHTML = text;
    }

    async _call(extension: string | null, camera: any) {
        this.ring("ringbacktone");
        this.setName("Calling...");
        this.currentCamera = (camera ? camera : undefined);
        await this.simpleUser.call("sip:" + extension + "@" + this.config.server);
    }

    async _answer() {
        await this.simpleUser.answer();
    }

    async _hangup() {
        await this.simpleUser.hangup();
    }

    async _toggleMute() {
        const pc: any = this.simpleUser.session.sessionDescriptionHandler.peerConnection
        pc.getSenders().forEach((stream: any) => {
            stream.track.enabled = !stream.track.enabled;
            console.log(stream.track.enabled);
            if (stream.track.enabled) {
                this.renderRoot.querySelector('#mute-icon').icon = "hass:microphone";
            } else {
                this.renderRoot.querySelector('#mute-icon').icon = "hass:microphone-off";
            }
        });

    }

    async _sendDTMF(signal: any) {
        await this.simpleUser.sendDTMF(signal);
    }

    async _button(entity: string) {
        const domain = entity.split(".")[0];
        let service;
        console.log(domain);
        
        switch(domain) {
            case "script":
                service = "turn_on";
                break;
            case "button":
                service = "press";
                break;
            case "scene":
                service = "turn_on";
                break;
            case "light":
                service = "toggle";
                break;
            case "switch":
                service = "toggle";
                break;
            case "input_boolean":
                service = "toggle";
                break;
            default:
                console.log("No supported service");
                return;
        }
        console.log(service);

        await this.hass.callService(domain, service, {
            entity_id: entity
        });
    }
    
    async connect() {
        this.timerElement = this.renderRoot.querySelector('#time');
        this.setTitle((this.config.custom_title !== "") ? this.config.custom_title : this.user.name);

        var options: Web.SimpleUserOptions = {
            aor: "sip:" + this.user.extension + "@" + this.config.server,
            media: {
                constraints: {
                    audio: true,
                    video: false
                },
                remote: {
                    audio: this.renderRoot.querySelector("#remoteAudio"),
                }
            },
            userAgentOptions: {
                authorizationUsername: this.user.extension,
                authorizationPassword: this.user.secret,
            }
        };

        if (this.config.video) {
            options!.media!.remote!.video = this.renderRoot.querySelector('#remoteVideo');
            options!.media!.constraints!.video = true;
        }
        
        this.simpleUser = new Web.SimpleUser("wss://" + this.config.server + ":" + this.config.port + "/ws", options);
        
        await this.simpleUser.connect();

        await this.simpleUser.register();
        this.setExtension(this.user.extension);

        this.simpleUser.delegate = {
            onCallReceived: async () => {
                var extension = this.simpleUser.session.remoteIdentity.uri.normal.user;
                this.config.extensions.forEach((element: { extension: any; camera: boolean; }) => {
                    if (element.extension == extension) {
                        this.currentCamera = (element.camera ? element.camera : undefined);
                    }
                });
                this.config.custom.forEach((element: { number: any; camera: boolean; }) => {
                    if (element.number == extension) {
                        this.currentCamera = (element.camera ? element.camera : undefined);
                    }
                });
                this.openPopup();
                if (this.config.auto_answer) {
                    await this.simpleUser.answer();
                    return;
                }

                this.ring("ringtone");

                if (this.simpleUser.session._assertedIdentity) {
                    this.setName("Incoming Call From " + this.simpleUser.session._assertedIdentity._displayName);
                } else {
                    this.setName("Incoming Call"); 
                }

            },
            onCallAnswered: () => {
                this.ring("pause");
                console.log(this.simpleUser.session);
                if (this.simpleUser.session._assertedIdentity) {
                    this.setName(this.simpleUser.session._assertedIdentity._displayName);
                } else {
                    this.setName("On Call");
                }
                var time = new Date();
                this.intervalId = window.setInterval(function(this: any): void {
                    var delta = Math.abs(new Date().getTime() - time.getTime()) / 1000;
                    var minutes = Math.floor(delta / 60) % 60;
                    delta -= minutes * 60;
                    var seconds = delta % 60;
                    this.timerElement.innerHTML = (minutes + ":" + Math.round(seconds)).split(':').map(e => `0${e}`.slice(-2)).join(':');
                }.bind(this), 1000);
            },
            onCallHangup: () => {
                this.ring("pause");
                this.setName("Idle");
                clearInterval(this.intervalId);
                this.timerElement.innerHTML = "00:00";
                this.currentCamera = undefined;
                this.closePopup();
            }
        };

        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('call')) {
            this._call(urlParams.get('call'), undefined); // TODO: Add camera here or in the _call function itself.
            this.openPopup();
        }
    }
}
 
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: "sipjs-card",
    name: "SIP Card",
    preview: false,
    description: "A SIP card, made by Jordy Kuhne."
});
