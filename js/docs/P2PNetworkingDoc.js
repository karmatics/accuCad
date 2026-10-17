class P2PNetworkingDoc {
  static get name() { return 'P2PNetworkingDoc'; }

  static getMeta() {
    return {
      kicker: "Networking & Remote Control",
      title: "P2P WebRTC Wireless Protocol & Control Integration",
      subtitle: "Low-latency WebRTC data channels, dynamic capability negotiation, and phone remote orchestration."
    };
  }

  static manifest() {
    return [
      {
        partLabel: "Part I",
        title: "Peer-to-Peer Signaling & WebRTC Transport",
        blocks: [
          { id: "p2pIntro", type: "paragraph" },
          { id: "signalingArchitecture", type: "sidebar", title: "Signaling & ICE Discovery", kicker: "WebRTC Transport" },
          { id: "heartbeatProtocol", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part II",
        title: "Dynamic Capability Exchange & Gesture Routing",
        blocks: [
          { id: "capabilitySchema", type: "paragraph" },
          { id: "messageDispatching", type: "sidebar", title: "Remote Control Event Routing", kicker: "Dispatch Table" },
          { id: "controllerIntegration", type: "paragraph" }
        ]
      }
    ];
  }

  static p2pIntro() {
    return [
      "accuCad includes an integrated peer-to-peer (P2P) wireless networking stack powered by **`P2PConnector.js`**. It enables any smartphone or secondary touch device to connect directly to the running CAD workstation without installing native apps, drivers, or software—simply by scanning an on-screen QR code."
    ];
  }

  static signalingArchitecture() {
    return [
      "Connection bootstrapping uses a dual-relay signaling architecture:\n1. **Room Discovery:** Host and client share a 4-digit room code.\n2. **Public WebSocket Relay (`wss://socketsbay.com`):** Sub-100ms exchange of WebRTC Session Description Protocol (SDP) offers, answers, and ICE candidate routes.\n3. **Direct DataChannel (`ctrl`):** Once ICE gathering completes, an encrypted, ordered peer-to-peer SCTP data channel opens directly between computer and mobile phone."
    ];
  }

  static heartbeatProtocol() {
    return [
      "To survive unstable Wi-Fi networks and mobile browser sleeping, `P2PConnector` implements a proactive heartbeat loop. It exchanges `ping` and `pong` messages every 3,000 milliseconds. If the channel remains silent for longer than 7,000 ms, the system automatically marks the session disconnected, tears down stale peer connections, and restarts auto-discovery without losing workstation scene state."
    ];
  }

  static capabilitySchema() {
    return [
      "Upon successful verification (`h-verified`), the host transmits its operational schema via `sendCapabilities()`. accuCad defines its capabilities via `BaseController.getP2PCapabilities()`, advertising navigation modes ('rotate', 'pan') for the left trackpad and transform controls ('sliders', 'tool') for the right trackpad. This ensures the mobile client automatically customizes its UI labels and gesture targets."
    ];
  }

  static messageDispatching() {
    return [
      "Incoming DataChannel messages map directly to workstation controller actions:\n• `drag` $\\rightarrow$ Orbit view or pan camera coordinates via `TransformView.transform()`.\n• `zoom` $\\rightarrow$ Proportional focal depth zoom.\n• `perspective` $\\rightarrow$ Three-finger camera FOV lens adjustment.\n• `accudrawZ` $\\rightarrow$ Four-finger vertical gesture rolling the infinite AccuDraw Z position wheel.\n• `sliderDragStart` / `sliderDragMove` / `sliderAdjust` $\\rightarrow$ Vertical selection and horizontal scrubbing of UI sliders."
    ];
  }

  static controllerIntegration() {
    return [
      "Remote gestures integrate seamlessly with workstation UI widgets. When the remote operator navigates sliders on their phone, an on-screen green dashed guide line tracks the active slider on the desktop monitor, and a floating neon HUD alerts the designer to mode changes without obscuring the 3D drawing canvas."
    ];
  }
}

globalThis.P2PNetworkingDoc = P2PNetworkingDoc;
if (typeof module !== 'undefined' && module.exports) module.exports = P2PNetworkingDoc;