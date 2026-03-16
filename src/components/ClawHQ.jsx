import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as Tone from "tone";

const AGENTS = [
  { id: "alpha", name: "Alpha", role: "Trader", color: 0x14f195, status: "working", tasks: 47, balance: 12.4 },
  { id: "bravo", name: "Bravo", role: "DeFi Strategist", color: 0x9945ff, status: "working", tasks: 32, balance: 8.7 },
  { id: "cipher", name: "Charlie", role: "Data Analyst", color: 0x00d1ff, status: "idle", tasks: 28, balance: 5.2 },
  { id: "delta", name: "Delta", role: "NFT Scout", color: 0xff6b6b, status: "idle", tasks: 19, balance: 3.1 },
  { id: "echo", name: "Echo", role: "Tx Executor", color: 0xffaa22, status: "working", tasks: 55, balance: 21.8 },
  { id: "flux", name: "Foxtrot", role: "Market Monitor", color: 0xff44aa, status: "idle", tasks: 41, balance: 6.9 },
];

const CHAT_RESPONSES = [
  "Copy that. Executing now.",
  "On it. Checking the orderbook...",
  "Roger. I'll have results in ~30s.",
  "Confirmed. Transaction submitted.",
  "Analyzing the data. Stand by.",
  "Market conditions look volatile. Proceeding with caution.",
  "Found 3 opportunities. Sending report.",
  "Done. TX hash: 5xK7m...9pQ2",
];

const ACTIVITY_TEMPLATES = [
  (a) => ({ hl: a.name, text: `scanned 12 new token launches` }),
  (a) => ({ hl: a.name, text: `executed swap: 0.5 SOL → USDC` }),
  (a) => ({ hl: a.name, text: `detected price anomaly on RAY/SOL` }),
  (a) => ({ hl: a.name, text: `updated portfolio allocation` }),
  (a) => ({ hl: a.name, text: `monitoring 3 active positions` }),
  (a) => ({ hl: a.name, text: `synced wallet: ${a.balance.toFixed(1)} SOL` }),
  (a) => ({ hl: a.name, text: `flagged suspicious on-chain transfer` }),
  (a) => ({ hl: a.name, text: `completed DCA order #${Math.floor(Math.random() * 100) + 1}` }),
];

function hexToCSS(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgb(${r},${g},${b})`;
}

function timeStr() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export default function ClawHQ() {
  // Sports room position constants (computed from staircase geometry)
  const SPORTS_X = 40;
  const SPORTS_Z = 23.1;
  const LEFT_GYM_X = -30;
  const LEFT_GYM_Z = 23.1;
  const BOTTOM_ROOM_X = 0;
  const BOTTOM_ROOM_Z = 45.6;

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const agentMeshesRef = useRef({});
  const agentTargetsRef = useRef({});
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const clockRef = useRef(null);
  const cameraStateRef = useRef({ angle: Math.PI / 4, pitch: 0.6, distance: 25, target: new THREE.Vector3(0, 0, 0) });
  const dragRef = useRef({ dragging: false, button: 0, prevX: 0, prevY: 0 });
  const frameRef = useRef(null);
  const labelContainerRef = useRef(null);
  const labelElemsRef = useRef({});
  const followAgentRef = useRef(null);
  const seatPositionsRef = useRef({});

  const [activePanel, setActivePanel] = useState("tasks");
  const [panelOpen, setPanelOpen] = useState(true);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef(null);
  const musicAutoStarted = useRef(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agents, setAgents] = useState(AGENTS.map(a => ({ ...a })));
  const [tasks, setTasks] = useState([]);
  const [chatLog, setChatLog] = useState([
    { from: "Alpha", text: "All systems nominal. Jupiter routes loaded.", color: hexToCSS(0x14f195) },
    { from: "Echo", text: "Mainnet connection stable. Ready to execute.", color: hexToCSS(0xffaa22) },
    { from: "Cipher", text: "Market data feed active. Monitoring 47 pairs.", color: hexToCSS(0x00d1ff) },
  ]);
  const [activityLog, setActivityLog] = useState([
    { time: timeStr(), hl: "CLAW HQ", text: "initialized. 6 agents online." },
    { time: timeStr(), hl: "Echo", text: "connected to Solana mainnet-beta" },
    { time: timeStr(), hl: "Alpha", text: "loaded Jupiter aggregator routes" },
  ]);
  const [taskInput, setTaskInput] = useState("");
  const [taskAgent, setTaskAgent] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState("alpha");
  const [hqPanelOpen, setHqPanelOpen] = useState(false);
  const [hqTab, setHqTab] = useState("playbooks");
  const [monitorModal, setMonitorModal] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [chatHistories, setChatHistories] = useState(() => {
    const h = {};
    AGENTS.forEach(a => { h[a.id] = []; });
    return h;
  });

  const toggleMusic = useCallback(async () => {
    if (musicPlaying) {
      if (musicRef.current) {
        musicRef.current.forEach(n => n.dispose());
        musicRef.current = null;
      }
      Tone.getTransport().stop();
      setMusicPlaying(false);
      return;
    }

    await Tone.start();

    const reverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination();
    const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.25 }).connect(reverb);
    const filter = new Tone.Filter({ frequency: 800, type: "lowpass" }).connect(delay);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 3, sustain: 0.4, release: 4 },
      volume: -18
    }).connect(filter);

    const pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2 },
      volume: -22
    }).connect(delay);

    const chords = [
      ["C3", "E3", "G3", "B3"],
      ["A2", "C3", "E3", "G3"],
      ["F2", "A2", "C3", "E3"],
      ["G2", "B2", "D3", "F3"],
    ];
    const melodyNotes = ["E4", "G4", "B4", "A4", "G4", "E4", "D4", "C4", "E4", "G4", "A4", "B4"];
    let chordIdx = 0;
    let melodyIdx = 0;

    const chordLoop = new Tone.Loop((time) => {
      pad.triggerAttackRelease(chords[chordIdx % chords.length], "3n", time);
      chordIdx++;
    }, "2m");

    const melodyLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.35) {
        pluck.triggerAttackRelease(melodyNotes[melodyIdx % melodyNotes.length], "8n", time);
      }
      melodyIdx++;
    }, "4n");

    chordLoop.start(0);
    melodyLoop.start("1m");
    Tone.getTransport().bpm.value = 65;
    Tone.getTransport().start();

    musicRef.current = [pad, pluck, reverb, delay, filter, chordLoop, melodyLoop];
    setMusicPlaying(true);
  }, [musicPlaying]);

  useEffect(() => {
    return () => {
      if (musicRef.current) {
        musicRef.current.forEach(n => n.dispose());
        Tone.getTransport().stop();
      }
    };
  }, []);

  // Auto-play music on first user interaction
  useEffect(() => {
    const autoStart = () => {
      if (!musicAutoStarted.current) {
        musicAutoStarted.current = true;
        toggleMusic();
        window.removeEventListener("mousedown", autoStart);
        window.removeEventListener("wheel", autoStart);
        window.removeEventListener("keydown", autoStart);
      }
    };
    window.addEventListener("mousedown", autoStart);
    window.addEventListener("wheel", autoStart);
    window.addEventListener("keydown", autoStart);
    return () => {
      window.removeEventListener("mousedown", autoStart);
      window.removeEventListener("wheel", autoStart);
      window.removeEventListener("keydown", autoStart);
    };
  }, [toggleMusic]);

  const chatEndRef = useRef(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  // ===== THREE.JS SCENE SETUP =====
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    sceneRef.current = scene;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const frustum = 12;

    const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, -100, 100);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0x556677, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
    scene.add(new THREE.DirectionalLight(0x9945ff, 0.15).translateX(-10).translateY(10).translateZ(-10));

    const mat = (c, em = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: em, emissiveIntensity: ei });

    // Floor (main office only)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 14), mat(0xd4c5a0));
    floor.position.set(0, -0.1, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const gm = mat(0xc4b590);
    for (let i = -9; i <= 9; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(i, 0.01, 0); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(18, 0.01, 0.02), gm); l.position.set(0, 0.01, i); scene.add(l); }

    // Walls
    const wm = mat(0x888888);
    const wallH = 1.5;
    // Back wall (main office only)
    const bw = new THREE.Mesh(new THREE.BoxGeometry(18, wallH, 0.15), wm); bw.position.set(0, wallH / 2, -7); bw.castShadow = true; scene.add(bw);
    // Left wall
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm); lw.position.set(-9, wallH / 2, 0); lw.castShadow = true; scene.add(lw);
    // Right wall (main office only, x:9)
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm); rw.position.set(9, wallH / 2, 0); rw.castShadow = true; scene.add(rw);
    // Front wall left
    const fwl = new THREE.Mesh(new THREE.BoxGeometry(6, wallH, 0.15), wm); fwl.position.set(-6, wallH / 2, 7); scene.add(fwl);
    // Front wall middle-right (original)
    const fwr = new THREE.Mesh(new THREE.BoxGeometry(6, wallH, 0.15), wm); fwr.position.set(6, wallH / 2, 7); scene.add(fwr);

    // ===== STAIRCASE going down from front entrance =====
    const stairMat = mat(0x999990);
    const stairWidth = 4;
    const numSteps = 6;
    const stepDrop = 0.22; // Y drop per step
    const stepDepth = 0.6; // Z depth per step
    for (let i = 0; i < numSteps; i++) {
      const stepY = -i * stepDrop;
      const stepZ = 7.3 + i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, 0.22, stepDepth), stairMat);
      step.position.set(0, stepY, stepZ); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }
    // Ground outside — top surface meets the last step
    const lastStepY = -(numSteps - 1) * stepDrop; // Y of last step center
    const lastStepZ = 7.3 + (numSteps - 1) * stepDepth + stepDepth / 2; // front edge of last step
    const outsideGround = new THREE.Mesh(new THREE.BoxGeometry(50, 0.22, 25), mat(0x888880));
    outsideGround.position.set(6, lastStepY, lastStepZ + 12.5);
    outsideGround.receiveShadow = true; scene.add(outsideGround);

    // ===== STAIRCASE on right side of ground going UP =====
    const groundRightEdge = 6 + 25; // ground center x + half width, no gap
    for (let i = 0; i < numSteps; i++) {
      const stepY = lastStepY + i * stepDrop;
      const stepX = groundRightEdge + i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, 0.22, stairWidth), stairMat);
      step.position.set(stepX, stepY, lastStepZ + 12.5); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }

    // ===== STAIRCASE on left side of ground going UP =====
    const groundLeftEdge = 6 - 25; // ground center x - half width
    for (let i = 0; i < numSteps; i++) {
      const stepY = lastStepY + i * stepDrop;
      const stepX = groundLeftEdge - i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, 0.22, stairWidth), stairMat);
      step.position.set(stepX, stepY, lastStepZ + 12.5); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }

    // ===== STAIRCASE at bottom of ground going UP =====
    const groundBottomEdge = lastStepZ + 25;
    for (let i = 0; i < numSteps; i++) {
      const stepY = lastStepY + i * stepDrop;
      const stepZ = groundBottomEdge + i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, 0.22, stepDepth), stairMat);
      step.position.set(0, stepY, stepZ); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }

    // ===== SPORTS ROOM — positioned at top of right staircase =====
    // Right stair top: x = groundRightEdge + (numSteps-1)*stepDepth = 31+3 = 34
    // Y at top = lastStepY + (numSteps-1)*stepDrop = 0
    // Z center = lastStepZ + 12.5
    const sportsX = 34 + 6; // center of sports room (offset from stair top)
    const sportsZ = lastStepZ + 12.5;
    const sportsY = 0; // same as building floor

    // Sports room floor
    const sportsFloor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 14), mat(0xcfbf95));
    sportsFloor.position.set(sportsX, sportsY - 0.1, sportsZ); sportsFloor.receiveShadow = true; scene.add(sportsFloor);

    // Sports room walls
    const srBackWall = new THREE.Mesh(new THREE.BoxGeometry(12, wallH, 0.15), wm);
    srBackWall.position.set(sportsX, wallH / 2, sportsZ - 7); srBackWall.castShadow = true; scene.add(srBackWall);
    const srFrontWall = new THREE.Mesh(new THREE.BoxGeometry(12, wallH, 0.15), wm);
    srFrontWall.position.set(sportsX, wallH / 2, sportsZ + 7); scene.add(srFrontWall);
    // Left wall — split with doorway for staircase entry (opening at center z, 4 units wide)
    const srLeftWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    srLeftWallTop.position.set(sportsX - 6, wallH / 2, sportsZ - 4.5); srLeftWallTop.castShadow = true; scene.add(srLeftWallTop);
    const srLeftWallBot = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    srLeftWallBot.position.set(sportsX - 6, wallH / 2, sportsZ + 4.5); srLeftWallBot.castShadow = true; scene.add(srLeftWallBot);
    const srRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm);
    srRightWall.position.set(sportsX + 6, wallH / 2, sportsZ); srRightWall.castShadow = true; scene.add(srRightWall);

    // Sports room grid
    for (let i = -5; i <= 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(sportsX + i, 0.01, sportsZ); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(12, 0.01, 0.02), gm); l.position.set(sportsX, 0.01, sportsZ + i); scene.add(l); }

    // Billiard / Pool table
    const poolTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.4), mat(0x0a5c2a));
    poolTop.position.set(sportsX, 0.82, sportsZ - 3); poolTop.castShadow = true; scene.add(poolTop);
    const poolFrame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.6), mat(0x3a2a15));
    poolFrame.position.set(sportsX, 0.78, sportsZ - 3); poolFrame.castShadow = true; scene.add(poolFrame);
    [[-1.2,-0.6],[1.2,-0.6],[-1.2,0.6],[1.2,0.6]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), mat(0x3a2a15));
      leg.position.set(sportsX+lx, 0.38, sportsZ-3+lz); leg.castShadow = true; scene.add(leg);
    });
    const pocketGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8);
    const pocketMat = mat(0x111111);
    [[-1.2,-0.6],[0,-0.6],[1.2,-0.6],[-1.2,0.6],[0,0.6],[1.2,0.6]].forEach(([px,pz]) => {
      const pocket = new THREE.Mesh(pocketGeo, pocketMat);
      pocket.position.set(sportsX+px, 0.87, sportsZ-3+pz); scene.add(pocket);
    });
    // Cue rack on back wall
    const cueRack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.08), mat(0x3a2a15));
    cueRack.position.set(sportsX, 0.8, sportsZ - 6.85); scene.add(cueRack);
    for (let ci = 0; ci < 3; ci++) {
      const cue = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.02), mat(0xc8a050));
      cue.position.set(sportsX - 0.3 + ci * 0.3, 0.8, sportsZ - 6.82); scene.add(cue);
    }

    // Ping pong table
    const pp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 1.2), mat(0x1a5533));
    pp.position.set(sportsX, 0.75, sportsZ + 3); pp.castShadow = true; scene.add(pp);
    const ppn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 1.2), mat(0xcccccc));
    ppn.position.set(sportsX, 0.85, sportsZ + 3); scene.add(ppn);
    [[-0.9,-0.4],[0.9,-0.4],[-0.9,0.4],[0.9,0.4]].forEach(([lx,lz]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), mat(0x555555));
      l.position.set(sportsX+lx, 0.375, sportsZ+3+lz); scene.add(l);
    });
    // Sports room plants
    mkPlant(sportsX - 5, sportsZ - 6); mkPlant(sportsX - 5, sportsZ + 5.5); mkPlant(sportsX + 5, sportsZ - 6); mkPlant(sportsX + 5, sportsZ + 5.5);

    // ===== FITNESS GYM — positioned at top of left staircase =====
    const leftStairTopX = groundLeftEdge - (numSteps - 1) * stepDepth;
    const gymHalfW = 8;
    const gymHalfD = 7;
    const gymX = leftStairTopX - gymHalfW;
    const gymZ = lastStepZ + 12.5;

    // Gym floor
    const gymFloor = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, 0.2, gymHalfD * 2), mat(0xc6b68c));
    gymFloor.position.set(gymX, -0.1, gymZ); gymFloor.receiveShadow = true; scene.add(gymFloor);

    // Gym walls
    const gymBackWall = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, wallH, 0.15), wm);
    gymBackWall.position.set(gymX, wallH / 2, gymZ - gymHalfD); gymBackWall.castShadow = true; scene.add(gymBackWall);
    const gymFrontWall = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, wallH, 0.15), wm);
    gymFrontWall.position.set(gymX, wallH / 2, gymZ + gymHalfD); scene.add(gymFrontWall);
    const gymLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, gymHalfD * 2), wm);
    gymLeftWall.position.set(gymX - gymHalfW, wallH / 2, gymZ); gymLeftWall.castShadow = true; scene.add(gymLeftWall);
    // Right wall split with doorway for left staircase entry
    const gymRightWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    gymRightWallTop.position.set(gymX + gymHalfW, wallH / 2, gymZ - 4.5); gymRightWallTop.castShadow = true; scene.add(gymRightWallTop);
    const gymRightWallBot = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    gymRightWallBot.position.set(gymX + gymHalfW, wallH / 2, gymZ + 4.5); gymRightWallBot.castShadow = true; scene.add(gymRightWallBot);

    // Gym grid
    for (let i = -(gymHalfW - 1); i <= gymHalfW - 1; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, gymHalfD * 2), gm); l.position.set(gymX + i, 0.01, gymZ); scene.add(l); }
    for (let i = -gymHalfD; i <= gymHalfD; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, 0.01, 0.02), gm); l.position.set(gymX, 0.01, gymZ + i); scene.add(l); }

    // Treadmill (x2)
    const treadmillPads = [
      { x: gymX - 2.6, z: gymZ + 4.2 },
      { x: gymX + 0.2, z: gymZ + 4.2 },
    ];
    treadmillPads.forEach(({ x, z }) => {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.8), mat(0x1e1e26));
      deck.position.set(x, 0.55, z); deck.castShadow = true; scene.add(deck);
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), mat(0x666670));
      railL.position.set(x - 0.6, 0.8, z - 0.25); scene.add(railL);
      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), mat(0x666670));
      railR.position.set(x + 0.6, 0.8, z - 0.25); scene.add(railR);
      const console = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.1), mat(0, 0x00d1ff, 0.5));
      console.position.set(x, 1.02, z - 0.25); scene.add(console);
    });

    // Elliptical cross trainer
    const ellipticalBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.55), mat(0x2a2a34));
    ellipticalBase.position.set(gymX + 3.1, 0.5, gymZ + 4.2); scene.add(ellipticalBase);
    const ellipticalPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), mat(0x666670));
    ellipticalPost.position.set(gymX + 3.1, 1.0, gymZ + 4.15); scene.add(ellipticalPost);
    const ellipticalHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0x888890));
    ellipticalHandleL.position.set(gymX + 2.8, 1.1, gymZ + 4.05); ellipticalHandleL.rotation.z = 0.15; scene.add(ellipticalHandleL);
    const ellipticalHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0x888890));
    ellipticalHandleR.position.set(gymX + 3.4, 1.1, gymZ + 4.05); ellipticalHandleR.rotation.z = -0.15; scene.add(ellipticalHandleR);

    // Stationary bike
    const bikeFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.35), mat(0x2a2a34));
    bikeFrame.position.set(gymX + 5.5, 0.45, gymZ + 4.3); scene.add(bikeFrame);
    const bikeSeat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.2), mat(0x1d1d25));
    bikeSeat.position.set(gymX + 5.35, 0.9, gymZ + 4.3); scene.add(bikeSeat);
    const bikeBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), mat(0x777777));
    bikeBar.position.set(gymX + 5.75, 1.02, gymZ + 4.3); scene.add(bikeBar);
    const bikeWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), mat(0x444444));
    bikeWheel.position.set(gymX + 5.95, 0.45, gymZ + 4.3); bikeWheel.rotation.x = Math.PI / 2; scene.add(bikeWheel);

    // Chest press machine
    const chestPressBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1), mat(0x2d2d36));
    chestPressBase.position.set(gymX + 5.2, 0.5, gymZ + 1.3); scene.add(chestPressBase);
    const chestPressBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.15), mat(0x1a1a22));
    chestPressBack.position.set(gymX + 4.8, 0.95, gymZ + 1.3); scene.add(chestPressBack);
    const chestPressHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), mat(0x888890));
    chestPressHandleL.position.set(gymX + 5.6, 1.02, gymZ + 1.0); scene.add(chestPressHandleL);
    const chestPressHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), mat(0x888890));
    chestPressHandleR.position.set(gymX + 5.6, 1.02, gymZ + 1.6); scene.add(chestPressHandleR);

    // Bench press
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.55), mat(0x2a2a30));
    bench.position.set(gymX + 1.2, 0.52, gymZ - 0.6); bench.castShadow = true; scene.add(bench);
    const benchLegL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat(0x555555));
    benchLegL.position.set(gymX + 0.45, 0.25, gymZ - 0.6); scene.add(benchLegL);
    const benchLegR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat(0x555555));
    benchLegR.position.set(gymX + 1.95, 0.25, gymZ - 0.6); scene.add(benchLegR);
    const barbell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 10), mat(0xaaaaaa));
    barbell.position.set(gymX + 1.2, 1.1, gymZ - 0.6); barbell.rotation.z = Math.PI / 2; scene.add(barbell);
    [[-1.2, 0.18], [-1.2, -0.18], [1.2, 0.18], [1.2, -0.18]].forEach(([dx, dz]) => {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), mat(0x444444));
      plate.position.set(gymX + 1.2 + dx, 1.1, gymZ - 0.6 + dz); plate.rotation.z = Math.PI / 2; scene.add(plate);
    });

    // Power rack + extra barbells
    const rackPosts = [
      { x: gymX - 1.6, z: gymZ - 1.8 },
      { x: gymX - 0.2, z: gymZ - 1.8 },
      { x: gymX - 1.6, z: gymZ - 0.4 },
      { x: gymX - 0.2, z: gymZ - 0.4 },
    ];
    rackPosts.forEach(({ x, z }) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), mat(0x67676f));
      post.position.set(x, 0.85, z); scene.add(post);
    });
    const rackTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 1.45), mat(0x4d4d56));
    rackTop.position.set(gymX - 0.9, 1.67, gymZ - 1.1); scene.add(rackTop);
    const rackBarbell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 10), mat(0xb6b6b6));
    rackBarbell.position.set(gymX - 0.9, 1.15, gymZ - 1.1); rackBarbell.rotation.z = Math.PI / 2; scene.add(rackBarbell);
    const spareBarbell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10), mat(0x9c9c9c));
    spareBarbell.position.set(gymX - 3.3, 0.5, gymZ - 5.4); spareBarbell.rotation.z = Math.PI / 2; scene.add(spareBarbell);

    // Trampoline
    const trampoline = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24), mat(0x1b1b20));
    trampoline.position.set(gymX + 2.2, 0.48, gymZ - 3.9); trampoline.castShadow = true; scene.add(trampoline);
    const trampolineRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 12, 28), mat(0xff6b6b));
    trampolineRing.position.set(gymX + 2.2, 0.56, gymZ - 3.9); trampolineRing.rotation.x = Math.PI / 2; scene.add(trampolineRing);

    // Ab wheel
    const abWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 10, 18), mat(0x333333));
    abWheel.position.set(gymX + 4.5, 0.2, gymZ - 3.3); abWheel.rotation.y = Math.PI / 2; scene.add(abWheel);
    const abAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8), mat(0xbbbbbb));
    abAxle.position.set(gymX + 4.5, 0.2, gymZ - 3.3); abAxle.rotation.z = Math.PI / 2; scene.add(abAxle);

    // Kettlebells
    const kettlebells = [
      { x: gymX + 4.1, z: gymZ - 5.8 },
      { x: gymX + 4.5, z: gymZ - 5.8 },
      { x: gymX + 4.9, z: gymZ - 5.8 },
    ];
    kettlebells.forEach(({ x, z }) => {
      const kb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), mat(0x2b2b2b));
      kb.position.set(x, 0.16, z); scene.add(kb);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 8, 14), mat(0x9a9a9a));
      handle.position.set(x, 0.28, z); handle.rotation.x = Math.PI / 2; scene.add(handle);
    });

    // Dumbbell rack + dumbbells + punching bag
    const dumbbellRack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.45), mat(0x2d2d36));
    dumbbellRack.position.set(gymX - 2.2, 0.45, gymZ - 6.2); dumbbellRack.castShadow = true; scene.add(dumbbellRack);
    for (let i = 0; i < 8; i++) {
      const dumbbell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), mat(0x111111));
      dumbbell.rotation.z = Math.PI / 2;
      dumbbell.position.set(gymX - 3.45 + i * 0.35, 0.72, gymZ - 6.2); scene.add(dumbbell);
    }
    // One pair of loose dumbbells on floor
    [-0.2, 0.2].forEach((dx) => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10), mat(0x141414));
      d.rotation.z = Math.PI / 2;
      d.position.set(gymX + 0.2 + dx, 0.12, gymZ - 4.8);
      scene.add(d);
    });
    const bagTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), mat(0x777777));
    bagTop.position.set(gymX - 4.7, 1.3, gymZ - 3.8); scene.add(bagTop);
    const punchBag = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.1, 14), mat(0xaa2a2a));
    punchBag.position.set(gymX - 4.7, 0.65, gymZ - 3.8); punchBag.castShadow = true; scene.add(punchBag);

    // Gym plants
    mkPlant(gymX + 7, gymZ - 6);
    mkPlant(gymX + 7, gymZ + 5.5);

    // ===== BOTTOM ROOM — positioned at top of bottom staircase =====
    const bottomStairTopZ = groundBottomEdge + (numSteps - 1) * stepDepth;
    const bottomRoomX = 0;
    const bottomRoomZ = bottomStairTopZ + 7;

    // Bottom room floor
    const bottomFloor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 14), mat(0xc8b88e));
    bottomFloor.position.set(bottomRoomX, -0.1, bottomRoomZ); bottomFloor.receiveShadow = true; scene.add(bottomFloor);

    // Bottom room walls
    // Back wall split for staircase entry doorway (4 units opening centered at x=0)
    const brBackLeft = new THREE.Mesh(new THREE.BoxGeometry(4, wallH, 0.15), wm);
    brBackLeft.position.set(bottomRoomX - 4, wallH / 2, bottomRoomZ - 7); brBackLeft.castShadow = true; scene.add(brBackLeft);
    const brBackRight = new THREE.Mesh(new THREE.BoxGeometry(4, wallH, 0.15), wm);
    brBackRight.position.set(bottomRoomX + 4, wallH / 2, bottomRoomZ - 7); brBackRight.castShadow = true; scene.add(brBackRight);
    const brFrontWall = new THREE.Mesh(new THREE.BoxGeometry(12, wallH, 0.15), wm);
    brFrontWall.position.set(bottomRoomX, wallH / 2, bottomRoomZ + 7); scene.add(brFrontWall);
    const brLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm);
    brLeftWall.position.set(bottomRoomX - 6, wallH / 2, bottomRoomZ); brLeftWall.castShadow = true; scene.add(brLeftWall);
    const brRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm);
    brRightWall.position.set(bottomRoomX + 6, wallH / 2, bottomRoomZ); brRightWall.castShadow = true; scene.add(brRightWall);

    // Bottom room grid
    for (let i = -5; i <= 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(bottomRoomX + i, 0.01, bottomRoomZ); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(12, 0.01, 0.02), gm); l.position.set(bottomRoomX, 0.01, bottomRoomZ + i); scene.add(l); }

    // Bottom room cafeteria setup
    const cafeCounter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.95, 1.1), mat(0x3a3020));
    cafeCounter.position.set(bottomRoomX, 0.47, bottomRoomZ + 5.6); cafeCounter.castShadow = true; scene.add(cafeCounter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.06, 1.2), mat(0x4b3d26));
    counterTop.position.set(bottomRoomX, 0.96, bottomRoomZ + 5.6); counterTop.castShadow = true; scene.add(counterTop);

    const coffeeMachine = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.52, 0.55), mat(0x222228));
    coffeeMachine.position.set(bottomRoomX - 1.9, 1.25, bottomRoomZ + 5.6); scene.add(coffeeMachine);
    const machineLight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.01), mat(0, 0x14f195, 1.4));
    machineLight.position.set(bottomRoomX - 1.9, 1.3, bottomRoomZ + 5.89); scene.add(machineLight);
    const coffeeNozzle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), mat(0x111118));
    coffeeNozzle.position.set(bottomRoomX - 1.9, 1.08, bottomRoomZ + 5.86); scene.add(coffeeNozzle);
    const register = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.4), mat(0x111118));
    register.position.set(bottomRoomX + 1.8, 1.12, bottomRoomZ + 5.6); scene.add(register);

    // Steam puffs for coffee machine
    const steamPuffs = [];
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xddeeea, transparent: true, opacity: 0.35, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), steamMat.clone());
      puff.position.set(bottomRoomX - 1.9, 1.15 + i * 0.07, bottomRoomZ + 5.9 + (Math.random() - 0.5) * 0.04);
      puff.userData = {
        baseX: bottomRoomX - 1.9,
        baseY: 1.12,
        baseZ: bottomRoomZ + 5.9,
        rise: Math.random() * 0.9,
        speed: 0.45 + Math.random() * 0.35,
        sway: Math.random() * Math.PI * 2,
      };
      scene.add(puff);
      steamPuffs.push(puff);
    }

    const cafeTableCenters = [
      { x: bottomRoomX - 2.1, z: bottomRoomZ + 1.3 },
      { x: bottomRoomX + 2.1, z: bottomRoomZ + 1.3 },
      { x: bottomRoomX, z: bottomRoomZ - 2.2 },
    ];
    cafeTableCenters.forEach(({ x, z }) => {
      const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 20), mat(0x4a3a24));
      tTop.position.set(x, 0.72, z); tTop.castShadow = true; scene.add(tTop);
      const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.66, 12), mat(0x2a2a30));
      tLeg.position.set(x, 0.35, z); scene.add(tLeg);

      for (let s = 0; s < 4; s++) {
        const ang = (s / 4) * Math.PI * 2;
        const sx = x + Math.cos(ang) * 1.25;
        const sz = z + Math.sin(ang) * 1.25;
        const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 12), mat(0x6a5a45));
        stoolSeat.position.set(sx, 0.52, sz); scene.add(stoolSeat);
        const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), mat(0x555555));
        stoolLeg.position.set(sx, 0.24, sz); scene.add(stoolLeg);
      }
    });

    // Fridge (replaces vending machine)
    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.9, 0.85), mat(0xd8dee6));
    fridgeBody.position.set(bottomRoomX - 5.1, 0.95, bottomRoomZ + 4.6); fridgeBody.castShadow = true; scene.add(fridgeBody);
    const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.75, 0.75), mat(0xe8eef4));
    fridgeDoor.position.set(bottomRoomX - 4.55, 0.95, bottomRoomZ + 4.6); scene.add(fridgeDoor);
    const fridgeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0x8a9098));
    fridgeHandle.position.set(bottomRoomX - 4.52, 0.95, bottomRoomZ + 4.92); scene.add(fridgeHandle);
    const fridgeCoolGlow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.5, 0.62), mat(0, 0x7cc7ff, 0.6));
    fridgeCoolGlow.position.set(bottomRoomX - 4.58, 0.95, bottomRoomZ + 4.6); scene.add(fridgeCoolGlow);
    const fridgeLeds = [];
    [0, 1, 2].forEach((idx) => {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.01), mat(0, [0x14f195, 0x00d1ff, 0xffaa22][idx], 1.2));
      led.rotation.y = Math.PI / 2;
      led.position.set(bottomRoomX - 4.57, 1.72, bottomRoomZ + 4.35 + idx * 0.12);
      led.userData.phase = Math.random() * Math.PI * 2;
      scene.add(led);
      fridgeLeds.push(led);
    });

    // Bottom room plants
    mkPlant(bottomRoomX - 5, bottomRoomZ - 6);
    mkPlant(bottomRoomX + 5, bottomRoomZ - 6);
    mkPlant(bottomRoomX - 5, bottomRoomZ + 5.5);
    mkPlant(bottomRoomX + 5, bottomRoomZ + 5.5);

    // Wall screens with live trading charts
    const wallScreenTextures = [];

    function mkScreen(x, y, z, chartType = "line") {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.06), mat(0x111118)); f.position.set(x, y, z); scene.add(f);
      const canvas = document.createElement("canvas");
      canvas.width = 192; canvas.height = 108;
      const ctx = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const scrMat = new THREE.MeshBasicMaterial({ map: texture });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.65), scrMat);
      s.position.set(x, y, z + 0.04); scene.add(s);
      const data = [];
      let price = 50 + Math.random() * 50;
      for (let i = 0; i < 40; i++) {
        price += (Math.random() - 0.48) * 4;
        price = Math.max(10, Math.min(100, price));
        data.push(price);
      }
      wallScreenTextures.push({ ctx, texture, canvas, data, chartType, offset: Math.random() * 100 });
    }

    function updateWallScreens(time) {
      wallScreenTextures.forEach(({ ctx, texture, data, chartType, offset }) => {
        const w = 192, h = 108;
        ctx.fillStyle = "#060d06";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(20,241,149,0.08)";
        ctx.lineWidth = 0.5;
        for (let gy = 20; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
        for (let gx = 20; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
        let price = data[data.length - 1];
        price += (Math.sin(time * 2 + offset) * 1.5 + (Math.random() - 0.48) * 2);
        price = Math.max(10, Math.min(100, price));
        data.push(price);
        if (data.length > 60) data.shift();
        const minP = Math.min(...data) - 5;
        const maxP = Math.max(...data) + 5;
        const range = maxP - minP || 1;
        if (chartType === "line") {
          ctx.beginPath();
          data.forEach((p, i) => { const px = (i / (data.length - 1)) * w; const py = h - 15 - ((p - minP) / range) * (h - 30); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
          ctx.strokeStyle = "#14f195"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "rgba(20,241,149,0.25)"); grad.addColorStop(1, "rgba(20,241,149,0.02)");
          ctx.fillStyle = grad; ctx.fill();
        } else if (chartType === "candle") {
          const barW = w / data.length;
          for (let i = 1; i < data.length; i++) {
            const open = data[i - 1], close = data[i];
            const high = Math.max(open, close) + Math.random() * 3, low = Math.min(open, close) - Math.random() * 3;
            const isUp = close >= open; const px = i * barW;
            const openY = h - 15 - ((open - minP) / range) * (h - 30);
            const closeY = h - 15 - ((close - minP) / range) * (h - 30);
            const highY = h - 15 - ((high - minP) / range) * (h - 30);
            const lowY = h - 15 - ((low - minP) / range) * (h - 30);
            ctx.strokeStyle = isUp ? "#14f195" : "#ff4444"; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(px, highY); ctx.lineTo(px, lowY); ctx.stroke();
            ctx.fillStyle = isUp ? "#14f195" : "#ff4444";
            ctx.fillRect(px - barW * 0.3, Math.min(openY, closeY), barW * 0.6, Math.max(Math.abs(closeY - openY), 1));
          }
        } else if (chartType === "bar") {
          const barW = w / data.length;
          data.forEach((p, i) => {
            const barH = ((p - minP) / range) * (h - 30);
            ctx.fillStyle = (i > 0 ? data[i] >= data[i - 1] : true) ? "rgba(20,241,149,0.6)" : "rgba(255,68,68,0.6)";
            ctx.fillRect(i * barW + 1, h - 15 - barH, barW - 2, barH);
          });
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, w, 14);
        ctx.fillStyle = "#14f195"; ctx.font = "bold 8px monospace";
        ctx.fillText({ line: "SOL/USDC", candle: "BTC/USD", bar: "VOLUME 24H" }[chartType] || "MARKET", 4, 10);
        ctx.fillStyle = price > data[data.length - 2] ? "#14f195" : "#ff4444";
        ctx.textAlign = "right"; ctx.fillText("$" + price.toFixed(2), w - 4, 10); ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(0, h - 10, w, 10);
        ctx.fillStyle = "#444444"; ctx.font = "6px monospace";
        const now = new Date();
        ctx.fillText(`${now.getHours()}:${now.getMinutes().toString().padStart(2,"0")}`, 4, h - 3);
        ctx.fillText("LIVE", w - 22, h - 3);
        texture.needsUpdate = true;
      });
    }

    // Sports room wall screens
    mkScreen(sportsX - 2, 1, sportsZ - 6.9, "line");
    mkScreen(sportsX + 2, 1, sportsZ - 6.9, "candle");

    // Main office screens
    mkScreen(0, 1, -6.9, "candle");
    mkScreen(4, 1, -6.9, "line");
    mkScreen(-4, 1, -6.9, "bar");

    // Game play positions
    // Ping pong — 2 players on opposite ends
    const pingPongSpots = [
      { x: sportsX - 1.4, z: sportsZ + 3, faceAngle: Math.PI / 2, game: "pingpong" },
      { x: sportsX + 1.4, z: sportsZ + 3, faceAngle: -Math.PI / 2, game: "pingpong" },
    ];
    // Billiards — 2 players on opposite sides
    const billiardSpots = [
      { x: sportsX - 1.8, z: sportsZ - 3, faceAngle: Math.PI / 2, game: "billiards" },
      { x: sportsX + 1.8, z: sportsZ - 3, faceAngle: -Math.PI / 2, game: "billiards" },
    ];
    const allGameSpots = [...pingPongSpots, ...billiardSpots];
    const occupiedGameSpots = new Set();

    const cafeSpots = [
      { x: bottomRoomX - 2.1, z: bottomRoomZ + 0.2, faceAngle: 0 },
      { x: bottomRoomX - 3.0, z: bottomRoomZ + 1.3, faceAngle: Math.PI / 2 },
      { x: bottomRoomX + 2.1, z: bottomRoomZ + 0.2, faceAngle: 0 },
      { x: bottomRoomX + 3.0, z: bottomRoomZ + 1.3, faceAngle: -Math.PI / 2 },
      { x: bottomRoomX, z: bottomRoomZ - 3.2, faceAngle: Math.PI },
      { x: bottomRoomX - 0.7, z: bottomRoomZ + 5.05, faceAngle: 0 },
    ];
    const occupiedCafeSpots = new Set();

    const gymSpots = [
      { x: gymX - 2.6, z: gymZ + 4.2, faceAngle: Math.PI, activity: "treadmill" },
      { x: gymX + 0.2, z: gymZ + 4.2, faceAngle: Math.PI, activity: "treadmill" },
      { x: gymX + 3.1, z: gymZ + 4.2, faceAngle: Math.PI, activity: "elliptical" },
      { x: gymX + 5.5, z: gymZ + 4.3, faceAngle: Math.PI, activity: "bike" },
      { x: gymX + 5.2, z: gymZ + 1.3, faceAngle: -Math.PI / 2, activity: "chestpress" },
      { x: gymX - 0.9, z: gymZ - 1.1, faceAngle: 0, activity: "power_rack" },
      { x: gymX + 1.2, z: gymZ - 0.6, faceAngle: 0, activity: "bench_press" },
      { x: gymX + 4.5, z: gymZ - 3.3, faceAngle: -Math.PI / 2, activity: "ab_wheel" },
      { x: gymX - 4.7, z: gymZ - 3.8, faceAngle: Math.PI / 2, activity: "punching_bag" },
      { x: gymX + 4.5, z: gymZ - 5.8, faceAngle: Math.PI, activity: "kettlebell" },
      { x: gymX - 2.2, z: gymZ - 6.2, faceAngle: 0, activity: "dumbbell" },
      { x: gymX - 3.3, z: gymZ - 5.4, faceAngle: 0, activity: "barbell" },
      { x: gymX + 2.2, z: gymZ - 3.9, faceAngle: 0, activity: "trampoline" },
    ];
    const occupiedGymSpots = new Set();

    // Game balls — hidden until agents are playing
    // Ping pong ball (small white sphere)
    const ppBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ppBall.position.set(sportsX, 0.9, sportsZ + 3);
    ppBall.visible = false;
    scene.add(ppBall);

    // Billiard balls (several colored balls on the table)
    const billiardBalls = [];
    const ballColors = [0xff0000, 0xffff00, 0x0000ff, 0xff8800, 0x00aa00, 0x880088];
    ballColors.forEach((color, i) => {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshLambertMaterial({ color })
      );
      // Spread balls across the table
      const bx = sportsX - 0.5 + (i % 3) * 0.5;
      const bz = sportsZ - 3.15 + Math.floor(i / 3) * 0.3;
      ball.position.set(bx, 0.9, bz);
      ball.visible = false;
      ball.userData.baseX = bx;
      ball.userData.baseZ = bz;
      scene.add(ball);
      billiardBalls.push(ball);
    });
    // Cue ball (white)
    const cueBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    cueBall.position.set(sportsX + 0.8, 0.9, sportsZ - 3);
    cueBall.visible = false;
    cueBall.userData.baseX = sportsX + 0.8;
    cueBall.userData.baseZ = sportsZ - 3;
    scene.add(cueBall);
    billiardBalls.push(cueBall);

    // Desks — each assigned to an agent with live screen
    const screenCanvases = {};
    const screenTextures = {};
    const screenCtxs = {};
    const monitorMeshes = {};

    function mkDesk(x, z, rot, agent) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), mat(0x3a3020)); top.position.y = 0.7; top.castShadow = true; g.add(top);
      const lgeo = new THREE.BoxGeometry(0.06, 0.7, 0.06); const lm = mat(0x2a2a30);
      [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([lx, lz]) => { const l = new THREE.Mesh(lgeo, lm); l.position.set(lx, 0.35, lz); g.add(l); });

      // Monitor frame
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.04), mat(0x111118)); mon.position.set(0, 1.05, -0.2); mon.castShadow = true; g.add(mon);

      // Live screen using canvas texture
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 96;
      const ctx = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const scrMat = new THREE.MeshBasicMaterial({ map: texture });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), scrMat);
      scr.position.set(0, 1.05, -0.17);
      g.add(scr);

      if (agent) {
        mon.userData.agentId = agent.id;
        scr.userData.agentId = agent.id;
        monitorMeshes[agent.id] = [mon, scr];
        screenCanvases[agent.id] = canvas;
        screenTextures[agent.id] = texture;
        screenCtxs[agent.id] = ctx;
      }

      // Monitor stand
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.06), mat(0x111118)); stand.position.set(0, 0.82, -0.2); g.add(stand);
      const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), mat(0x111118)); standBase.position.set(0, 0.74, -0.2); g.add(standBase);

      // Keyboard
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.12), mat(0x222228)); kb.position.set(0, 0.74, 0.05); g.add(kb);
      for (let row = 0; row < 3; row++) {
        const keyRow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.005, 0.025), mat(0x333340));
        keyRow.position.set(0, 0.755, -0.01 + row * 0.035); g.add(keyRow);
      }
      const spacebar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.005, 0.025), mat(0x333340));
      spacebar.position.set(0, 0.755, 0.1); g.add(spacebar);

      // Mouse
      const mouseBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.09), mat(0x222228));
      mouseBody.position.set(0.28, 0.74, 0.05); g.add(mouseBody);
      const mouseTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.07), mat(0x2a2a35));
      mouseTop.position.set(0.28, 0.755, 0.045); g.add(mouseTop);
      const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.02), mat(0x444450));
      scroll.position.set(0.28, 0.762, 0.03); g.add(scroll);
      const mousePad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.005, 0.2), mat(0x1a1a22));
      mousePad.position.set(0.28, 0.725, 0.05); g.add(mousePad);

      // Name plate on desk
      if (agent) {
        const plateColor = agent.color;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02), mat(plateColor));
        plate.position.set(-0.35, 0.78, -0.2); g.add(plate);
        // Name text via small canvas
        const nameCanvas = document.createElement("canvas");
        nameCanvas.width = 64; nameCanvas.height = 16;
        const nctx = nameCanvas.getContext("2d");
        nctx.fillStyle = "#0a0a0f";
        nctx.fillRect(0, 0, 64, 16);
        nctx.fillStyle = "#ffffff";
        nctx.font = "bold 10px monospace";
        nctx.textAlign = "center";
        nctx.fillText(agent.name, 32, 12);
        const nameTex = new THREE.CanvasTexture(nameCanvas);
        nameTex.minFilter = THREE.LinearFilter;
        const nameMat = new THREE.MeshBasicMaterial({ map: nameTex });
        const nameTag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.06), nameMat);
        nameTag.position.set(-0.35, 0.78, -0.19);
        g.add(nameTag);
      }

      // Office chair
      const chairColor = agent ? agent.color : 0x333345;
      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), mat(chairColor));
      seatMesh.position.set(0, 0.45, 0.55); seatMesh.castShadow = true; g.add(seatMesh);
      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.05), mat(chairColor));
      backMesh.position.set(0, 0.65, 0.73); backMesh.castShadow = true; g.add(backMesh);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x555555));
      pole.position.set(0, 0.27, 0.55); g.add(pole);
      for (let j = 0; j < 5; j++) {
        const angle = (j / 5) * Math.PI * 2;
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), mat(0x555555));
        legMesh.position.set(Math.sin(angle) * 0.1, 0.1, 0.55 + Math.cos(angle) * 0.1);
        legMesh.rotation.y = angle;
        g.add(legMesh);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), mat(0x222222));
        wheel.position.set(Math.sin(angle) * 0.2, 0.04, 0.55 + Math.cos(angle) * 0.2);
        wheel.rotation.x = Math.PI / 2;
        g.add(wheel);
      }

      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }

    // Assign desks to agents
    const deskPositions = [
      [-6,-5,0], [-3,-5,0], [0,-5,0],
      [-6,-2,Math.PI], [-3,-2,Math.PI], [0,-2,Math.PI]
    ];
    const agentSeatPositions = {};
    AGENTS.forEach((a, i) => {
      const [x, z, r] = deskPositions[i];
      mkDesk(x, z, r, a);
      // Chair is at local z=0.55, rotated by desk rotation
      const seatX = x + Math.sin(r) * 0.55;
      const seatZ = z + Math.cos(r) * 0.55;
      // Agent faces the desk (opposite of chair front)
      const faceAngle = r + Math.PI;
      agentSeatPositions[a.id] = { x: seatX, z: seatZ, faceAngle, deskRot: r };
    });
    seatPositionsRef.current = agentSeatPositions;

    // Screen update function — draws live terminal-style display
    const screenLines = {};
    AGENTS.forEach(a => { screenLines[a.id] = []; });

    const screenMessages = {
      alpha: ["Scanning Jupiter routes...", "SOL/USDC spread: 0.02%", "Executing swap: 2 SOL", "TX confirmed: 5xK7m...", "P&L: +0.34 SOL", "Checking orderbook depth"],
      bravo: ["Analyzing yield farms...", "APY comparison running", "Rebalancing portfolio", "Moving 30% to stables", "Risk score: LOW", "DeFi TVL: $4.2B"],
      cipher: ["Querying on-chain data...", "Parsing 1,247 txns", "Anomaly detected: 0x8f..", "Report generated", "Clustering wallets...", "Data pipeline healthy"],
      delta: ["Scanning NFT floors...", "Tensor: 12.4 SOL floor", "New collection alert!", "Rarity analysis done", "Listing snipe ready", "Watching 3 collections"],
      echo: ["TX queue: 3 pending", "Sending 0.5 SOL to 7xQ..", "Confirmed in 400ms", "Gas: 0.000005 SOL", "Batch TX: 5/5 done", "Nonce updated"],
      flux: ["Market feed active", "SOL: $168.42 (+2.1%)", "Volume spike: RAY/SOL", "Alert: BTC dominance ↓", "Monitoring 47 pairs", "Sentiment: bullish"],
    };

    function updateScreen(agentId, time) {
      const ctx = screenCtxs[agentId];
      const tex = screenTextures[agentId];
      const agent = AGENTS.find(a => a.id === agentId);
      if (!ctx || !tex || !agent) return;

      // Check if agent is sitting at their desk
      const target = agentTargetsRef.current[agentId];
      const isAtDesk = target && target.sitting;

      const r = (agent.color >> 16) & 0xff;
      const g = (agent.color >> 8) & 0xff;
      const b = agent.color & 0xff;

      if (!isAtDesk) {
        // === IDLE SCREEN — agent not at desk ===
        ctx.fillStyle = "#050805";
        ctx.fillRect(0, 0, 128, 96);

        // Header bar dimmed
        ctx.fillStyle = `rgba(${r},${g},${b},0.1)`;
        ctx.fillRect(0, 0, 128, 12);
        ctx.fillStyle = "#444444";
        ctx.font = "bold 8px monospace";
        ctx.fillText(agent.name.toUpperCase(), 4, 9);

        // Status: IDLE
        ctx.fillStyle = "#ffaa22";
        ctx.fillRect(108, 3, 6, 6);
        ctx.fillStyle = "#555555";
        ctx.font = "6px monospace";
        ctx.fillText("IDLE", 88, 9);

        // Idle message centered
        ctx.fillStyle = "#333333";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Agent away", 64, 42);
        ctx.fillText("Waiting for return...", 64, 54);
        ctx.textAlign = "left";

        // Dim bottom bar
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 86, 128, 10);
        ctx.fillStyle = "#333333";
        ctx.font = "6px monospace";
        ctx.fillText("disconnected", 4, 93);

        tex.needsUpdate = true;
        // Clear terminal lines when away
        screenLines[agentId] = [];
        return;
      }

      // === ACTIVE SCREEN — agent is working at desk ===
      ctx.fillStyle = "#0a0f0a";
      ctx.fillRect(0, 0, 128, 96);

      // Header bar
      ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
      ctx.fillRect(0, 0, 128, 12);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px monospace";
      ctx.fillText(agent.name.toUpperCase(), 4, 9);

      // Status: RUNNING
      ctx.fillStyle = "#14f195";
      ctx.fillRect(108, 3, 6, 6);
      ctx.fillStyle = "#666666";
      ctx.font = "6px monospace";
      ctx.fillText("RUN", 88, 9);

      // Terminal lines
      const msgs = screenMessages[agentId] || ["..."];
      const lines = screenLines[agentId];

      // Add new line periodically
      if (Math.floor(time * 0.5) !== Math.floor((time - 0.05) * 0.5)) {
        lines.push(msgs[Math.floor(Math.random() * msgs.length)]);
        if (lines.length > 7) lines.shift();
      }

      ctx.fillStyle = "#14f195";
      ctx.font = "7px monospace";
      lines.forEach((line, i) => {
        const alpha = 0.4 + (i / lines.length) * 0.6;
        ctx.fillStyle = `rgba(20,241,149,${alpha})`;
        ctx.fillText("> " + line, 4, 22 + i * 10);
      });

      // Blinking cursor
      if (Math.floor(time * 2) % 2 === 0) {
        ctx.fillStyle = "#14f195";
        ctx.fillRect(4, 22 + lines.length * 10, 5, 7);
      }

      // Bottom status bar
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, 86, 128, 10);
      ctx.fillStyle = "#666666";
      ctx.font = "6px monospace";
      const now = new Date();
      ctx.fillText(`${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`, 4, 93);
      ctx.fillText("solana-mainnet", 60, 93);

      tex.needsUpdate = true;
    }

    // Meeting table
    const mt = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.08, 32), mat(0x3a3020)); mt.position.set(-5, 0.72, 4); mt.castShadow = true; scene.add(mt);
    const mtl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.72, 8), mat(0x2a2a30)); mtl.position.set(-5, 0.36, 4); scene.add(mtl);

    // Meeting chairs
    const tableCenter = { x: -5, z: 4 };
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cx = tableCenter.x + Math.cos(angle) * 2.2;
      const cz = tableCenter.z + Math.sin(angle) * 2.2;
      
      // Compute angle FROM chair TO table center
      const toTableAngle = Math.atan2(tableCenter.x - cx, tableCenter.z - cz);
      
      const cg = new THREE.Group();
      // Seat
      const mSeat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.36), mat(0x444460));
      mSeat.position.y = 0.42; cg.add(mSeat);
      // Backrest — at +z in local space (will face AWAY from table after rotation)
      const mBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.04), mat(0x444460));
      mBack.position.set(0, 0.6, 0.18); cg.add(mBack);
      // Pole
      const mPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), mat(0x666666));
      mPole.position.y = 0.25; cg.add(mPole);
      // Base legs
      for (let j = 0; j < 5; j++) {
        const la = (j / 5) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.18), mat(0x666666));
        leg.position.set(Math.sin(la) * 0.09, 0.09, Math.cos(la) * 0.09);
        leg.rotation.y = la;
        cg.add(leg);
      }
      cg.position.set(cx, 0, cz);
      // rotation.y in Three.js rotates around Y axis; -z local axis faces direction of rotation.y
      // We want -z (open/front) to face the table, so set rotation.y = toTableAngle
      cg.rotation.y = toTableAngle + Math.PI;
      scene.add(cg);
    }

    // Couches
    function mkCouch(x, z, rot = 0, c = 0x2a2a55) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.8), mat(c)); s.position.y = 0.35; s.castShadow = true; g.add(s);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.2), mat(c)); b.position.set(0, 0.6, -0.3); b.castShadow = true; g.add(b);
      const al = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat(c)); al.position.set(-0.92, 0.52, 0); g.add(al);
      const ar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat(c)); ar.position.set(0.92, 0.52, 0); g.add(ar);
      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }
    mkCouch(5, 3, 0, 0x2a2a55);
    mkCouch(5, 5.5, Math.PI, 0x352a40);
    mkCouch(7.5, 4.2, -Math.PI / 2, 0x2a3545);

    // Sofa seat positions — calculated from couch geometry
    // Couch backrest is at local z=-0.3, seat cushion at local z=0 to z=0.4
    // Agent should sit on cushion facing AWAY from backrest (toward +z in local space)
    const sofaSeats = [
      // Couch 1 (x:5, z:3, rot:0) — backrest at world z=2.7, seat at z=3.0-3.4, face +z
      { x: 4.4, z: 3.2, faceAngle: 0, seatY: 0.2 },
      { x: 5, z: 3.2, faceAngle: 0, seatY: 0.2 },
      { x: 5.6, z: 3.2, faceAngle: 0, seatY: 0.2 },
      // Couch 2 (x:5, z:5.5, rot:PI) — rotated 180, backrest at world z=5.8, seat at z=5.5-5.1, face -z
      { x: 4.4, z: 5.3, faceAngle: Math.PI, seatY: 0.2 },
      { x: 5, z: 5.3, faceAngle: Math.PI, seatY: 0.2 },
      { x: 5.6, z: 5.3, faceAngle: Math.PI, seatY: 0.2 },
      // Couch 3 (x:7.5, z:4.2, rot:-PI/2) — rotated -90, backrest at world x=7.8, seat at x=7.5-7.1, face -x
      { x: 7.3, z: 3.8, faceAngle: -Math.PI / 2, seatY: 0.2 },
      { x: 7.3, z: 4.6, faceAngle: -Math.PI / 2, seatY: 0.2 },
    ];
    const occupiedSofaSeats = new Set();

    // Coffee table
    const ct = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), mat(0x3a3020)); ct.position.set(5, 0.4, 4.25); scene.add(ct);
    // Coffee table legs
    const ctLegGeo = new THREE.BoxGeometry(0.05, 0.38, 0.05);
    const ctLegMat = mat(0x2a2a30);
    [[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(ctLegGeo, ctLegMat);
      leg.position.set(5 + lx, 0.19, 4.25 + lz);
      scene.add(leg);
    });

    // (Ping pong moved to sports room)

    // Server racks
    function mkRack(x, z) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.5), mat(0x1a1a22)); r.position.set(x, 1, z); r.castShadow = true; scene.add(r);
      for (let i = 0; i < 5; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), mat(0, [0x14f195, 0x9945ff, 0x00d1ff][i % 3], 2));
        led.position.set(x - 0.2, 0.4 + i * 0.35, z - 0.26); scene.add(led);
      }
    }
    mkRack(8.2, -6); mkRack(8.2, -5); mkRack(8.2, -4);

    // Plants
    function mkPlant(x, z) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), mat(0x553322)); p.position.set(x, 0.15, z); scene.add(p);
      const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.35, 0.6, 6), mat(0x226633, 0x14f195, 0.1)); lv.position.set(x, 0.6, z); scene.add(lv);
    }
    mkPlant(-8.3, -6); mkPlant(-8.3, 0); mkPlant(-8.3, 5);

    // ===== COLLISION OBSTACLES (AABB: { minX, maxX, minZ, maxZ }) =====
    const obstacles = [];
    // Main office walls
    obstacles.push({ minX: -9.1, maxX: 9.1, minZ: -7.15, maxZ: -6.85 }); // back wall
    obstacles.push({ minX: -9.15, maxX: -8.85, minZ: -7, maxZ: 7 }); // left wall
    obstacles.push({ minX: 8.85, maxX: 9.15, minZ: -7, maxZ: 7 }); // right wall
    obstacles.push({ minX: -9, maxX: -3, minZ: 6.85, maxZ: 7.15 }); // front wall left
    obstacles.push({ minX: 3, maxX: 9, minZ: 6.85, maxZ: 7.15 }); // front wall right
    // Sports room walls
    obstacles.push({ minX: sportsX - 6.1, maxX: sportsX + 6.1, minZ: sportsZ - 7.15, maxZ: sportsZ - 6.85 }); // back
    obstacles.push({ minX: sportsX - 6.1, maxX: sportsX + 6.1, minZ: sportsZ + 6.85, maxZ: sportsZ + 7.15 }); // front
    obstacles.push({ minX: sportsX - 6.15, maxX: sportsX - 5.85, minZ: sportsZ - 7, maxZ: sportsZ - 2 }); // left wall top
    obstacles.push({ minX: sportsX - 6.15, maxX: sportsX - 5.85, minZ: sportsZ + 2, maxZ: sportsZ + 7 }); // left wall bottom
    obstacles.push({ minX: sportsX + 5.85, maxX: sportsX + 6.15, minZ: sportsZ - 7, maxZ: sportsZ + 7 }); // right
    // Gym walls
    obstacles.push({ minX: gymX - 8.1, maxX: gymX + 8.1, minZ: gymZ - 7.15, maxZ: gymZ - 6.85 }); // back
    obstacles.push({ minX: gymX - 8.1, maxX: gymX + 8.1, minZ: gymZ + 6.85, maxZ: gymZ + 7.15 }); // front
    obstacles.push({ minX: gymX - 8.15, maxX: gymX - 7.85, minZ: gymZ - 7, maxZ: gymZ + 7 }); // left
    obstacles.push({ minX: gymX + 7.85, maxX: gymX + 8.15, minZ: gymZ - 7, maxZ: gymZ - 2 }); // right wall top
    obstacles.push({ minX: gymX + 7.85, maxX: gymX + 8.15, minZ: gymZ + 2, maxZ: gymZ + 7 }); // right wall bottom
    // Bottom room walls
    obstacles.push({ minX: -6.1, maxX: -1.9, minZ: bottomRoomZ - 7.15, maxZ: bottomRoomZ - 6.85 }); // back left
    obstacles.push({ minX: 1.9, maxX: 6.1, minZ: bottomRoomZ - 7.15, maxZ: bottomRoomZ - 6.85 }); // back right
    obstacles.push({ minX: -6.1, maxX: 6.1, minZ: bottomRoomZ + 6.85, maxZ: bottomRoomZ + 7.15 }); // front
    obstacles.push({ minX: -6.15, maxX: -5.85, minZ: bottomRoomZ - 7, maxZ: bottomRoomZ + 7 }); // left
    obstacles.push({ minX: 5.85, maxX: 6.15, minZ: bottomRoomZ - 7, maxZ: bottomRoomZ + 7 }); // right
    // Desks
    [[-6,-5],[-3,-5],[0,-5],[-6,-2],[-3,-2],[0,-2]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.5, maxZ: z + 0.5 });
    });
    // Meeting table
    obstacles.push({ minX: -6.8, maxX: -3.2, minZ: 2.2, maxZ: 5.8 });
    // Couches
    obstacles.push({ minX: 3.8, maxX: 6.2, minZ: 2.4, maxZ: 3.6 });
    obstacles.push({ minX: 3.8, maxX: 6.2, minZ: 4.9, maxZ: 6.1 });
    obstacles.push({ minX: 6.9, maxX: 7.7, minZ: 3.0, maxZ: 5.4 });
    // Coffee table
    obstacles.push({ minX: 4.2, maxX: 5.8, minZ: 3.8, maxZ: 4.7 });
    // Server racks
    obstacles.push({ minX: 7.7, maxX: 8.7, minZ: -6.5, maxZ: -3.5 });
    // Billiard table (sports room)
    obstacles.push({ minX: sportsX - 1.7, maxX: sportsX + 1.7, minZ: sportsZ - 3.9, maxZ: sportsZ - 2.1 });
    // Ping pong table (sports room)
    obstacles.push({ minX: sportsX - 1.3, maxX: sportsX + 1.3, minZ: sportsZ + 2.2, maxZ: sportsZ + 3.8 });
    // Cue rack (sports room back wall)
    obstacles.push({ minX: sportsX - 0.8, maxX: sportsX + 0.8, minZ: sportsZ - 7, maxZ: sportsZ - 6.5 });
    // Gym equipment
    obstacles.push({ minX: gymX - 3.5, maxX: gymX - 1.7, minZ: gymZ + 3.7, maxZ: gymZ + 4.7 }); // treadmill left
    obstacles.push({ minX: gymX - 0.7, maxX: gymX + 1.1, minZ: gymZ + 3.7, maxZ: gymZ + 4.7 }); // treadmill right
    obstacles.push({ minX: gymX + 2.4, maxX: gymX + 3.8, minZ: gymZ + 3.8, maxZ: gymZ + 4.6 }); // elliptical
    obstacles.push({ minX: gymX + 4.9, maxX: gymX + 6.3, minZ: gymZ + 3.8, maxZ: gymZ + 4.8 }); // stationary bike
    obstacles.push({ minX: gymX + 4.4, maxX: gymX + 6.0, minZ: gymZ + 0.8, maxZ: gymZ + 1.8 }); // chest press machine
    obstacles.push({ minX: gymX - 1.8, maxX: gymX + 0.0, minZ: gymZ - 2.0, maxZ: gymZ - 0.2 }); // power rack
    obstacles.push({ minX: gymX + 0.0, maxX: gymX + 2.4, minZ: gymZ - 1.0, maxZ: gymZ - 0.2 }); // bench press
    obstacles.push({ minX: gymX + 1.0, maxX: gymX + 3.4, minZ: gymZ - 5.1, maxZ: gymZ - 2.7 }); // trampoline
    obstacles.push({ minX: gymX - 3.9, maxX: gymX - 0.5, minZ: gymZ - 6.5, maxZ: gymZ - 5.9 }); // dumbbell rack
    obstacles.push({ minX: gymX + 3.9, maxX: gymX + 5.1, minZ: gymZ - 6.0, maxZ: gymZ - 5.6 }); // kettlebells
    obstacles.push({ minX: gymX - 5.05, maxX: gymX - 4.35, minZ: gymZ - 4.2, maxZ: gymZ - 3.4 }); // punching bag
    obstacles.push({ minX: gymX + 4.25, maxX: gymX + 4.75, minZ: gymZ - 3.55, maxZ: gymZ - 3.05 }); // ab wheel
    // Bottom room cafeteria props
    obstacles.push({ minX: -2.95, maxX: 2.95, minZ: bottomRoomZ + 4.95, maxZ: bottomRoomZ + 6.25 }); // counter
    obstacles.push({ minX: -3.1, maxX: -1.1, minZ: bottomRoomZ + 0.3, maxZ: bottomRoomZ + 2.3 }); // left table area
    obstacles.push({ minX: 1.1, maxX: 3.1, minZ: bottomRoomZ + 0.3, maxZ: bottomRoomZ + 2.3 }); // right table area
    obstacles.push({ minX: -1.05, maxX: 1.05, minZ: bottomRoomZ - 3.2, maxZ: bottomRoomZ - 1.2 }); // rear table area
    obstacles.push({ minX: -5.65, maxX: -4.5, minZ: bottomRoomZ + 4.15, maxZ: bottomRoomZ + 5.1 }); // fridge
    // Plants (main office + sports room + gym)
    [[-8.3,-6],[-8.3,0],[-8.3,5],[sportsX-5,sportsZ-6],[sportsX-5,sportsZ+5.5],[sportsX+5,sportsZ-6],[sportsX+5,sportsZ+5.5],[gymX+7,gymZ-6],[gymX+7,gymZ+5.5]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    });
    [[bottomRoomX-5,bottomRoomZ-6],[bottomRoomX+5,bottomRoomZ-6],[bottomRoomX-5,bottomRoomZ+5.5],[bottomRoomX+5,bottomRoomZ+5.5]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    });

    const agentRadius = 0.35;

    function isBlocked(x, z) {
      for (const ob of obstacles) {
        if (x + agentRadius > ob.minX && x - agentRadius < ob.maxX &&
            z + agentRadius > ob.minZ && z - agentRadius < ob.maxZ) {
          return true;
        }
      }
      return false;
    }

    function pickValidTarget() {
      for (let attempts = 0; attempts < 30; attempts++) {
        let x;
        let z;
        const zoneRoll = Math.random();
        if (zoneRoll < 0.45) {
          x = -8 + Math.random() * 16;
          z = -6 + Math.random() * 12;
        } else if (zoneRoll < 0.6) {
          x = -16 + Math.random() * 36;
          z = 10 + Math.random() * 20;
        } else if (zoneRoll < 0.72) {
          x = sportsX - 5 + Math.random() * 10;
          z = sportsZ - 6 + Math.random() * 12;
        } else if (zoneRoll < 0.86) {
          x = gymX - 7 + Math.random() * 14;
          z = gymZ - 6 + Math.random() * 12;
        } else {
          x = bottomRoomX - 5 + Math.random() * 10;
          z = bottomRoomZ - 6 + Math.random() * 12;
        }
        if (!isBlocked(x, z)) return { x, z };
      }
      return { x: 2, z: 0 };
    }

    // ===== AGENTS =====
    // Spawn at valid non-colliding positions
    const startPositions = [];
    for (let i = 0; i < 6; i++) {
      startPositions.push(pickValidTarget());
    }

    // Hair styles and skin tones per agent for variety
    const agentStyles = [
      { skin: 0xddb88c, hair: 0x222222, hairStyle: "flat" },
      { skin: 0xc68c53, hair: 0x111111, hairStyle: "tall" },
      { skin: 0xf5d0a9, hair: 0x8b4513, hairStyle: "side" },
      { skin: 0xd4a373, hair: 0xcc3333, hairStyle: "mohawk" },
      { skin: 0xe8c49a, hair: 0xf0e68c, hairStyle: "flat" },
      { skin: 0xbf8b60, hair: 0x1a1a2e, hairStyle: "tall" },
    ];

    AGENTS.forEach((a, i) => {
      const g = new THREE.Group();
      const style = agentStyles[i];

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.3), mat(a.color));
      body.position.y = 0.7; body.castShadow = true; g.add(body);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.3), mat(style.skin));
      head.position.y = 1.2; head.castShadow = true; g.add(head);

      // === FACE (all on front face z=0.16) ===

      // Eyes — white sclera + dark pupil
      const scleraGeo = new THREE.BoxGeometry(0.08, 0.06, 0.01);
      const scleraMat = mat(0xffffff);
      const pupilGeo = new THREE.BoxGeometry(0.04, 0.05, 0.01);
      const pupilMat = mat(0x111111);

      const eyeLSclera = new THREE.Mesh(scleraGeo, scleraMat);
      eyeLSclera.position.set(-0.08, 1.22, 0.16); g.add(eyeLSclera);
      const eyeLPupil = new THREE.Mesh(pupilGeo, pupilMat);
      eyeLPupil.position.set(-0.08, 1.22, 0.17); g.add(eyeLPupil);

      const eyeRSclera = new THREE.Mesh(scleraGeo, scleraMat);
      eyeRSclera.position.set(0.08, 1.22, 0.16); g.add(eyeRSclera);
      const eyeRPupil = new THREE.Mesh(pupilGeo, pupilMat);
      eyeRPupil.position.set(0.08, 1.22, 0.17); g.add(eyeRPupil);

      // Eyebrows
      const browGeo = new THREE.BoxGeometry(0.1, 0.025, 0.01);
      const browMat = mat(style.hair);
      const browL = new THREE.Mesh(browGeo, browMat);
      browL.position.set(-0.08, 1.28, 0.16); browL.rotation.z = -0.1; g.add(browL);
      const browR = new THREE.Mesh(browGeo, browMat);
      browR.position.set(0.08, 1.28, 0.16); browR.rotation.z = 0.1; g.add(browR);

      // Nose
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), mat(style.skin * 0.9 | 0));
      nose.position.set(0, 1.17, 0.17); g.add(nose);

      // Mouth
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.01), mat(0x993333));
      mouth.position.set(0, 1.1, 0.16); g.add(mouth);

      // === HAIR ===
      const hairMat = mat(style.hair);

      if (style.hairStyle === "flat") {
        // Flat top hair
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.08, 0.32), hairMat);
        hairTop.position.set(0, 1.42, -0.01); hairTop.castShadow = true; g.add(hairTop);
        // Side hair
        const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.32), hairMat);
        hairL.position.set(-0.19, 1.3, -0.01); g.add(hairL);
        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.32), hairMat);
        hairR.position.set(0.19, 1.3, -0.01); g.add(hairR);
        // Back hair
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.25, 0.04), hairMat);
        hairBack.position.set(0, 1.32, -0.17); g.add(hairBack);
      } else if (style.hairStyle === "tall") {
        // Tall/afro style
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.34), hairMat);
        hairTop.position.set(0, 1.46, -0.01); hairTop.castShadow = true; g.add(hairTop);
        const hairMid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.36), hairMat);
        hairMid.position.set(0, 1.38, -0.01); g.add(hairMid);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.3, 0.05), hairMat);
        hairBack.position.set(0, 1.32, -0.18); g.add(hairBack);
      } else if (style.hairStyle === "side") {
        // Side swept
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.32), hairMat);
        hairTop.position.set(0.03, 1.42, -0.01); hairTop.castShadow = true; g.add(hairTop);
        // Swept fringe
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), hairMat);
        fringe.position.set(-0.1, 1.38, 0.15); fringe.rotation.z = 0.2; g.add(fringe);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.28, 0.04), hairMat);
        hairBack.position.set(0, 1.32, -0.17); g.add(hairBack);
        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.32), hairMat);
        hairR.position.set(0.19, 1.3, -0.01); g.add(hairR);
      } else if (style.hairStyle === "mohawk") {
        // Mohawk
        const spike1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.06), hairMat);
        spike1.position.set(0, 1.48, 0.05); g.add(spike1);
        const spike2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.06), hairMat);
        spike2.position.set(0, 1.47, -0.04); g.add(spike2);
        const spike3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.06), hairMat);
        spike3.position.set(0, 1.45, -0.12); g.add(spike3);
        // Shaved sides (slightly darker skin)
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.28), mat(style.skin * 0.85 | 0));
        sideL.position.set(-0.18, 1.35, -0.01); g.add(sideL);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.28), mat(style.skin * 0.85 | 0));
        sideR.position.set(0.18, 1.35, -0.01); g.add(sideR);
      }

      // Legs with pivot at hip
      const legGeo = new THREE.BoxGeometry(0.16, 0.4, 0.2);
      const legM = mat(0x222233);

      const legLPivot = new THREE.Group();
      legLPivot.position.set(-0.12, 0.42, 0);
      const legLMesh = new THREE.Mesh(legGeo, legM);
      legLMesh.position.y = -0.2;
      legLPivot.add(legLMesh);
      g.add(legLPivot);

      const legRPivot = new THREE.Group();
      legRPivot.position.set(0.12, 0.42, 0);
      const legRMesh = new THREE.Mesh(legGeo, legM);
      legRMesh.position.y = -0.2;
      legRPivot.add(legRMesh);
      g.add(legRPivot);

      // Arms with pivot at shoulder
      const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.18);

      const armLPivot = new THREE.Group();
      armLPivot.position.set(-0.32, 0.92, 0);
      const armLMesh = new THREE.Mesh(armGeo, mat(a.color));
      armLMesh.position.y = -0.22;
      armLPivot.add(armLMesh);
      g.add(armLPivot);

      const armRPivot = new THREE.Group();
      armRPivot.position.set(0.32, 0.92, 0);
      const armRMesh = new THREE.Mesh(armGeo, mat(a.color));
      armRMesh.position.y = -0.22;
      armRPivot.add(armRMesh);
      g.add(armRPivot);

      // Status ring
      const ringGeo = new THREE.RingGeometry(0.3, 0.38, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: a.status === "working" ? 0x14f195 : 0xffaa22, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);

      g.userData = { ring, agentId: a.id, legLPivot, legRPivot, armLPivot, armRPivot, walkPhase: Math.random() * Math.PI * 2 };

      const sp = startPositions[i];
      g.position.set(sp.x, 0, sp.z);
      scene.add(g);
      agentMeshesRef.current[a.id] = g;
      agentTargetsRef.current[a.id] = {
        x: sp.x, z: sp.z, timer: Math.random() * 3 + 2,
        sitting: false, goToDesk: false, sitTimer: 0, commanded: false,
        sofaSitting: false, goToSofa: false, sofaSeatIdx: -1, sofaSitTimer: 0,
        cafeSitting: false, goToCafe: false, cafeSpotIdx: -1, cafeTimer: 0, cafePhase: 0,
        gyming: false, goToGym: false, gymSpotIdx: -1, gymTimer: 0, gymPhase: 0, gymActivity: "",
        playing: false, goToGame: false, gameSpotIdx: -1, playTimer: 0, playPhase: 0, waypoints: []
      };
    });

    // Camera update
    function updateCam() {
      const cs = cameraStateRef.current;
      const cam = cameraRef.current;
      const ren = rendererRef.current;
      if (!cam || !ren) return;
      const w = ren.domElement.clientWidth;
      const h = ren.domElement.clientHeight;
      const asp = w / h;
      cam.position.x = cs.target.x + Math.cos(cs.angle) * cs.distance * Math.cos(cs.pitch);
      cam.position.z = cs.target.z + Math.sin(cs.angle) * cs.distance * Math.cos(cs.pitch);
      cam.position.y = cs.distance * Math.sin(cs.pitch);
      cam.lookAt(cs.target);
      const d = cs.distance * 0.55;
      cam.left = -d * asp; cam.right = d * asp; cam.top = d; cam.bottom = -d;
      cam.updateProjectionMatrix();
    }

    updateCam();

    // === WAYPOINT NAVIGATION ===
    const ZONE_OFFICE_CENTER = { x: -1.5, z: -3.5 }; // aisle between desk rows
    const ZONE_OFFICE_DOOR = { x: 0, z: 6.5 };
    const ZONE_GROUND_CENTER = { x: 15, z: lastStepZ + 12.5 };
    const ZONE_SPORTS_DOOR = { x: sportsX - 5.5, z: sportsZ };
    const ZONE_SPORTS_CENTER = { x: sportsX, z: sportsZ }; // center of sports room is clear

    function getZone(x, z) {
      if (x >= -9 && x <= 9 && z >= -7 && z <= 7) return "office";
      if (x >= sportsX - 6 && x <= sportsX + 6 && z >= sportsZ - 7 && z <= sportsZ + 7) return "sports";
      return "ground";
    }

    function buildWaypoints(fromX, fromZ, toX, toZ) {
      const fromZone = getZone(fromX, fromZ);
      const toZone = getZone(toX, toZ);
      if (fromZone === toZone) return [];
      const wp = [];
      if (fromZone === "office" && toZone === "sports") {
        wp.push(ZONE_OFFICE_CENTER, ZONE_OFFICE_DOOR, ZONE_GROUND_CENTER, ZONE_SPORTS_DOOR, ZONE_SPORTS_CENTER);
      } else if (fromZone === "sports" && toZone === "office") {
        wp.push(ZONE_SPORTS_CENTER, ZONE_SPORTS_DOOR, ZONE_GROUND_CENTER, ZONE_OFFICE_DOOR, ZONE_OFFICE_CENTER);
      } else if (fromZone === "office" && toZone === "ground") {
        wp.push(ZONE_OFFICE_CENTER, ZONE_OFFICE_DOOR);
      } else if (fromZone === "ground" && toZone === "office") {
        wp.push(ZONE_OFFICE_DOOR, ZONE_OFFICE_CENTER);
      } else if (fromZone === "sports" && toZone === "ground") {
        wp.push(ZONE_SPORTS_CENTER, ZONE_SPORTS_DOOR);
      } else if (fromZone === "ground" && toZone === "sports") {
        wp.push(ZONE_SPORTS_DOOR, ZONE_SPORTS_CENTER);
      }
      return wp;
    }

    function walkToward(mesh, tx, tz, dt) {
      const dx = tx - mesh.position.x;
      const dz = tz - mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.0) return true;
      const speed = 1.5 * dt;
      mesh.position.x += (dx / dist) * speed;
      mesh.position.z += (dz / dist) * speed;
      mesh.rotation.y = Math.atan2(dx, dz);
      const ud = mesh.userData;
      ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
      const swing = Math.sin(ud.walkPhase) * 0.6;
      if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
      if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
      if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
      if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
      mesh.position.y = 0;
      return false;
    }

    // Animate
    const clock = new THREE.Clock();
    clockRef.current = clock;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      // Move agents with collision
      Object.entries(agentTargetsRef.current).forEach(([id, target], agentIdx) => {
        const mesh = agentMeshesRef.current[id];
        if (!mesh) return;
        const ud = mesh.userData;

        // === SITTING STATE ===
        if (target.sitting) {
          const seat = agentSeatPositions[id];
          if (seat) {
            mesh.position.x = seat.x;
            mesh.position.z = seat.z;
            mesh.position.y = 0.18;
            mesh.rotation.y = seat.faceAngle;
            if (ud.legLPivot) ud.legLPivot.rotation.x = -1.2;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -1.2;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.5; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.5; ud.armRPivot.rotation.z = 0; }
          }
          // Auto-stand after sitTimer expires (only if not commanded to stay)
          if (!target.commanded) {
            target.sitTimer -= dt;
            if (target.sitTimer <= 0) {
              target.sitting = false;
              target.goToDesk = false;
              mesh.position.y = 0;
              if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
              if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
              if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
              if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
              // Step beside desk
              if (seat) {
                mesh.position.x = seat.x + Math.cos(seat.deskRot) * 1.2;
                mesh.position.z = seat.z - Math.sin(seat.deskRot) * 1.2;
              }
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 6 + 4;
            }
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GOING TO DESK ===
        if (target.goToDesk) {
          const seat = agentSeatPositions[id];
          if (seat) {
            const dx = seat.x - mesh.position.x;
            const dz = seat.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.sitting = true;
              target.goToDesk = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === SOFA SITTING STATE ===
        if (target.sofaSitting) {
          const seat = sofaSeats[target.sofaSeatIdx];
          if (seat) {
            mesh.position.x = seat.x;
            mesh.position.z = seat.z;
            mesh.position.y = seat.seatY;
            mesh.rotation.y = seat.faceAngle;
            // Relaxed sitting pose — legs bent forward, arms resting on armrests
            if (ud.legLPivot) ud.legLPivot.rotation.x = -1.1;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -1.1;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.2; ud.armLPivot.rotation.z = -0.4; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.2; ud.armRPivot.rotation.z = 0.4; }
          }
          // Auto-stand from sofa
          target.sofaSitTimer -= dt;
          if (target.sofaSitTimer <= 0) {
            target.sofaSitting = false;
            if (target.sofaSeatIdx >= 0) occupiedSofaSeats.delete(target.sofaSeatIdx);
            target.sofaSeatIdx = -1;
            mesh.position.y = 0;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            // Step away from sofa — teleport to clear walkway area
            mesh.position.x = 2 + (Math.random() - 0.5) * 2;
            mesh.position.z = 1 + (Math.random() - 0.5) * 2;
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GOING TO SOFA ===
        if (target.goToSofa) {
          const seat = sofaSeats[target.sofaSeatIdx];
          if (seat) {
            const dx = seat.x - mesh.position.x;
            const dz = seat.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.sofaSitting = true;
              target.goToSofa = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === CAFETERIA STATE ===
        if (target.cafeSitting) {
          const spot = cafeSpots[target.cafeSpotIdx];
          if (spot) {
            mesh.position.x = spot.x;
            mesh.position.z = spot.z;
            mesh.position.y = 0.2;
            mesh.rotation.y = spot.faceAngle;
            target.cafePhase += dt * 4;
            if (ud.legLPivot) ud.legLPivot.rotation.x = -1.05;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -1.05;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.35; ud.armLPivot.rotation.z = -0.1; }
            if (ud.armRPivot) {
              ud.armRPivot.rotation.x = -0.55 + Math.sin(target.cafePhase) * 0.22;
              ud.armRPivot.rotation.z = 0.15;
            }
          }
          target.cafeTimer -= dt;
          if (target.cafeTimer <= 0) {
            target.cafeSitting = false;
            if (target.cafeSpotIdx >= 0) occupiedCafeSpots.delete(target.cafeSpotIdx);
            target.cafeSpotIdx = -1;
            target.cafePhase = 0;
            mesh.position.y = 0;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        if (target.goToCafe) {
          const spot = cafeSpots[target.cafeSpotIdx];
          if (spot) {
            const dx = spot.x - mesh.position.x;
            const dz = spot.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.cafeSitting = true;
              target.goToCafe = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GYM ACTIVITY STATE ===
        if (target.gyming) {
          const spot = gymSpots[target.gymSpotIdx];
          if (spot) {
            mesh.position.x = spot.x;
            mesh.position.z = spot.z;
            mesh.rotation.y = spot.faceAngle;
            target.gymPhase += dt * 6;
            const p = target.gymPhase;
            const pulse = Math.sin(p);
            mesh.position.y = 0;

            if (spot.activity === "treadmill") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = pulse * 0.8;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -pulse * 0.8;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -pulse * 0.55;
              if (ud.armRPivot) ud.armRPivot.rotation.x = pulse * 0.55;
            } else if (spot.activity === "elliptical") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = pulse * 0.45;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -pulse * 0.45;
              if (ud.armLPivot) ud.armLPivot.rotation.x = pulse * 0.65;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -pulse * 0.65;
            } else if (spot.activity === "bike") {
              mesh.position.y = 0.05;
              if (ud.legLPivot) ud.legLPivot.rotation.x = pulse * 1.0;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -pulse * 1.0;
              if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.65; ud.armLPivot.rotation.z = -0.1; }
              if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.65; ud.armRPivot.rotation.z = 0.1; }
            } else if (spot.activity === "chestpress") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.55;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.55;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.35 + Math.max(0, pulse) * 0.85;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.35 + Math.max(0, pulse) * 0.85;
            } else if (spot.activity === "power_rack") {
              mesh.position.y = Math.abs(pulse) * 0.12;
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.35 - Math.abs(pulse) * 0.6;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.35 - Math.abs(pulse) * 0.6;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.95;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.95;
            } else if (spot.activity === "bench_press") {
              mesh.position.y = 0.08;
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.75;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.75;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -1.1 + Math.max(0, pulse) * 0.9;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -1.1 + Math.max(0, pulse) * 0.9;
            } else if (spot.activity === "ab_wheel") {
              mesh.position.y = 0.03;
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.25;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.25;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.8 - Math.abs(pulse) * 0.5;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.8 - Math.abs(pulse) * 0.5;
            } else if (spot.activity === "punching_bag") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = 0.1;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.12;
              if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.45; ud.armLPivot.rotation.z = -0.1; }
              if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.35 + Math.max(0, pulse) * 1.0; ud.armRPivot.rotation.z = 0.25; }
            } else if (spot.activity === "trampoline") {
              mesh.position.y = Math.abs(pulse) * 0.35;
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.1 + pulse * 0.2;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.1 - pulse * 0.2;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.7 + Math.abs(pulse) * 0.35;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.7 + Math.abs(pulse) * 0.35;
            } else if (spot.activity === "kettlebell") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.25;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.25;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.7 + Math.max(0, pulse) * 0.9;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.7 + Math.max(0, pulse) * 0.9;
            } else if (spot.activity === "dumbbell") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
              if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.45 + Math.abs(pulse) * 1.1;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.45 + Math.abs(Math.sin(p + Math.PI / 2)) * 1.1;
            } else if (spot.activity === "barbell") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.2;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.2;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.8 + Math.max(0, pulse) * 0.7;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.8 + Math.max(0, pulse) * 0.7;
            }
          }

          target.gymTimer -= dt;
          if (target.gymTimer <= 0) {
            target.gyming = false;
            if (target.gymSpotIdx >= 0) occupiedGymSpots.delete(target.gymSpotIdx);
            target.gymSpotIdx = -1;
            target.gymActivity = "";
            mesh.position.y = 0;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        if (target.goToGym) {
          const spot = gymSpots[target.gymSpotIdx];
          if (spot) {
            const dx = spot.x - mesh.position.x;
            const dz = spot.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.gyming = true;
              target.goToGym = false;
              target.gymActivity = spot.activity;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === PLAYING GAME ===
        if (target.playing) {
          const spot = allGameSpots[target.gameSpotIdx];
          if (spot) {
            mesh.position.x = spot.x;
            mesh.position.z = spot.z;
            mesh.position.y = 0;
            mesh.rotation.y = spot.faceAngle;

            // Check if partner is also at the table (playing, not still walking)
            let partnerReady = false;
            Object.entries(agentTargetsRef.current).forEach(([otherId, ot]) => {
              if (otherId === id) return;
              if (ot.playing && ot.gameSpotIdx >= 0) {
                const otherSpot = allGameSpots[ot.gameSpotIdx];
                if (otherSpot && otherSpot.game === spot.game) partnerReady = true;
              }
            });

            if (partnerReady) {
              // Both players at table — play!
              target.playPhase += dt * 6;

              if (spot.game === "pingpong") {
                if (ud.armRPivot) ud.armRPivot.rotation.x = -0.8 + Math.sin(target.playPhase) * 0.6;
                if (ud.armLPivot) ud.armLPivot.rotation.x = -0.3;
                if (ud.legLPivot) ud.legLPivot.rotation.x = Math.sin(target.playPhase * 0.5) * 0.15;
                if (ud.legRPivot) ud.legRPivot.rotation.x = -Math.sin(target.playPhase * 0.5) * 0.15;
              } else {
                if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.6 + Math.sin(target.playPhase * 0.3) * 0.2; ud.armRPivot.rotation.z = 0; }
                if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.6; ud.armLPivot.rotation.z = 0; }
                if (ud.legLPivot) ud.legLPivot.rotation.x = 0.1;
                if (ud.legRPivot) ud.legRPivot.rotation.x = -0.15;
              }

              // Only count down timer when both are playing
              target.playTimer -= dt;
            } else {
              // Waiting for partner — idle standing pose at the table
              if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.9;
              if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.9;
              if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.9;
              if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.9;
            }
          }
          // Auto-stop playing
          target.playTimer -= dt;
          if (target.playTimer <= 0) {
            // Find partner at the same table and stop them too
            const spot = allGameSpots[target.gameSpotIdx];
            const gameType = spot?.game;
            const mySpotIdx = target.gameSpotIdx;

            // Stop this agent
            target.playing = false;
            if (mySpotIdx >= 0) occupiedGameSpots.delete(mySpotIdx);
            target.gameSpotIdx = -1;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            mesh.position.x = sportsX + (Math.random() - 0.5) * 4;
            mesh.position.z = sportsZ + (Math.random() - 0.5) * 2;
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;

            // Find and stop partner
            Object.entries(agentTargetsRef.current).forEach(([otherId, otherTarget]) => {
              if (otherId === id) return;
              if (otherTarget.playing || otherTarget.goToGame) {
                const otherSpot = allGameSpots[otherTarget.gameSpotIdx];
                if (otherSpot && otherSpot.game === gameType) {
                  const otherMesh = agentMeshesRef.current[otherId];
                  otherTarget.playing = false;
                  otherTarget.goToGame = false;
                  if (otherTarget.gameSpotIdx >= 0) occupiedGameSpots.delete(otherTarget.gameSpotIdx);
                  otherTarget.gameSpotIdx = -1;
                  otherTarget.playTimer = 0;
                  if (otherMesh) {
                    const oud = otherMesh.userData;
                    if (oud.legLPivot) oud.legLPivot.rotation.x = 0;
                    if (oud.legRPivot) oud.legRPivot.rotation.x = 0;
                    if (oud.armLPivot) { oud.armLPivot.rotation.x = 0; oud.armLPivot.rotation.z = 0; }
                    if (oud.armRPivot) { oud.armRPivot.rotation.x = 0; oud.armRPivot.rotation.z = 0; }
                    otherMesh.position.x = sportsX + (Math.random() - 0.5) * 4;
                    otherMesh.position.z = sportsZ + (Math.random() - 0.5) * 2;
                    otherMesh.position.y = 0;
                  }
                  const v = pickValidTarget();
                  otherTarget.x = v.x;
                  otherTarget.z = v.z;
                  otherTarget.timer = Math.random() * 5 + 3;
                }
              }
            });
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GOING TO GAME ===
        if (target.goToGame) {
          const spot = allGameSpots[target.gameSpotIdx];
          if (spot) {
            const dx = spot.x - mesh.position.x;
            const dz = spot.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.playing = true;
              target.goToGame = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === NORMAL WALKING ===
        target.timer -= dt;
        if (target.timer <= 0) {
          const roll = Math.random();
          if (roll < 0.22) {
            // 22% — go sit at desk
            target.goToDesk = true;
            target.commanded = false;
            target.sitTimer = Math.random() * 30 + 30;
            target.timer = 999;
          } else if (roll < 0.34) {
            // 12% — go sit on a sofa
            const available = [];
            sofaSeats.forEach((s, idx) => {
              if (!occupiedSofaSeats.has(idx)) available.push(idx);
            });
            if (available.length > 0) {
              const seatIdx = available[Math.floor(Math.random() * available.length)];
              target.goToSofa = true;
              target.sofaSeatIdx = seatIdx;
              target.sofaSitTimer = Math.random() * 30 + 30;
              occupiedSofaSeats.add(seatIdx);
              target.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else if (roll < 0.50) {
            // 16% — go to cafeteria
            const availableCafe = [];
            cafeSpots.forEach((s, idx) => {
              if (!occupiedCafeSpots.has(idx)) availableCafe.push(idx);
            });
            if (availableCafe.length > 0) {
              const spotIdx = availableCafe[Math.floor(Math.random() * availableCafe.length)];
              target.goToCafe = true;
              target.cafeSpotIdx = spotIdx;
              target.cafeTimer = Math.random() * 20 + 20;
              target.cafePhase = 0;
              occupiedCafeSpots.add(spotIdx);
              target.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else if (roll < 0.66) {
            // 16% — go to gym activity
            const availableGym = [];
            gymSpots.forEach((s, idx) => {
              if (!occupiedGymSpots.has(idx)) availableGym.push(idx);
            });
            if (availableGym.length > 0) {
              const spotIdx = availableGym[Math.floor(Math.random() * availableGym.length)];
              target.goToGym = true;
              target.gymSpotIdx = spotIdx;
              target.gymTimer = Math.random() * 25 + 25;
              target.gymPhase = 0;
              target.gymActivity = gymSpots[spotIdx].activity;
              occupiedGymSpots.add(spotIdx);
              target.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else if (roll < 0.80) {
            // 14% — invite another agent to play a game
            const games = [
              { spots: [0, 1], name: "pingpong" },
              { spots: [2, 3], name: "billiards" },
            ];
            const availableGames = games.filter(g => g.spots.every(idx => !occupiedGameSpots.has(idx)));
            const freeAgents = Object.entries(agentTargetsRef.current).filter(([otherId, ot]) => {
              return otherId !== id && !ot.sitting && !ot.goToDesk && !ot.sofaSitting && !ot.goToSofa && !ot.cafeSitting && !ot.goToCafe && !ot.gyming && !ot.goToGym && !ot.playing && !ot.goToGame;
            });

            if (availableGames.length > 0 && freeAgents.length > 0) {
              const game = availableGames[Math.floor(Math.random() * availableGames.length)];
              const [partnerId, partnerTarget] = freeAgents[Math.floor(Math.random() * freeAgents.length)];
              const playTime = Math.random() * 30 + 30;

              // Send this agent to spot 0
              target.goToGame = true;
              target.gameSpotIdx = game.spots[0];
              target.playTimer = playTime;
              target.playPhase = 0;
              occupiedGameSpots.add(game.spots[0]);
              target.timer = 999;

              // Send partner to spot 1
              partnerTarget.goToGame = true;
              partnerTarget.gameSpotIdx = game.spots[1];
              partnerTarget.playTimer = playTime;
              partnerTarget.playPhase = Math.PI; // offset animation phase
              occupiedGameSpots.add(game.spots[1]);
              partnerTarget.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else {
            // 20% — keep walking
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
        }
        const dx = target.x - mesh.position.x;
        const dz = target.z - mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.15) {
          const speed = 1.2 * dt;
          const nx = mesh.position.x + (dx / dist) * speed;
          const nz = mesh.position.z + (dz / dist) * speed;
          const prevX = mesh.position.x;
          const prevZ = mesh.position.z;

          // Check agent-agent collision
          const agentMinDist = 0.7;
          let agentBlocked = false;
          for (const [otherId, otherMesh] of Object.entries(agentMeshesRef.current)) {
            if (otherId === id || !otherMesh) continue;
            const adx = nx - otherMesh.position.x;
            const adz = nz - otherMesh.position.z;
            if (Math.sqrt(adx * adx + adz * adz) < agentMinDist) {
              agentBlocked = true;
              break;
            }
          }

          if (agentBlocked) {
            const perpX = mesh.position.x + (-dz / dist) * speed;
            const perpZ = mesh.position.z + (dx / dist) * speed;
            let perpBlocked = false;
            for (const [otherId, otherMesh] of Object.entries(agentMeshesRef.current)) {
              if (otherId === id || !otherMesh) continue;
              const adx = perpX - otherMesh.position.x;
              const adz = perpZ - otherMesh.position.z;
              if (Math.sqrt(adx * adx + adz * adz) < agentMinDist) {
                perpBlocked = true;
                break;
              }
            }
            if (!perpBlocked && !isBlocked(perpX, perpZ)) {
              mesh.position.x = perpX;
              mesh.position.z = perpZ;
            }
          } else if (!isBlocked(nx, nz)) {
            mesh.position.x = nx;
            mesh.position.z = nz;
          } else {
            if (!isBlocked(nx, mesh.position.z)) {
              mesh.position.x = nx;
            } else if (!isBlocked(mesh.position.x, nz)) {
              mesh.position.z = nz;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 3 + 2;
            }
          }

          // Check if agent actually moved
          const moved = Math.abs(mesh.position.x - prevX) > 0.001 || Math.abs(mesh.position.z - prevZ) > 0.001;
          const ud = mesh.userData;

          if (moved) {
            mesh.rotation.y = Math.atan2(dx, dz);

            // Walk animation
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) ud.armLPivot.rotation.x = -swing * 0.7;
            if (ud.armRPivot) ud.armRPivot.rotation.x = swing * 0.7;
          } else {
            // Blocked — ease limbs to rest
            if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.85;
            if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.85;
            if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.85;
            if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.85;
          }
          mesh.position.y = 0;
        } else {
          // Idle
          const ud = mesh.userData;
          if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.85;
          if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.85;
          if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.85;
          if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.85;
          const breathe = Math.sin(Date.now() * 0.002 + agentIdx * 1.5) * 0.015;
          mesh.position.y = 0;
          if (ud.armLPivot) ud.armLPivot.rotation.z = breathe;
          if (ud.armRPivot) ud.armRPivot.rotation.z = -breathe;
        }
        const ring = mesh.userData.ring;
        if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
      });

      // Follow agent — smoothly track their position
      if (followAgentRef.current) {
        const followMesh = agentMeshesRef.current[followAgentRef.current];
        if (followMesh) {
          const cs = cameraStateRef.current;
          // Smoothly lerp camera target to agent position + mid-body height
          cs.target.x += (followMesh.position.x - cs.target.x) * 0.08;
          cs.target.y += (0.7 - cs.target.y) * 0.08;
          cs.target.z += (followMesh.position.z - cs.target.z) * 0.08;
        }
      } else {
        // When not following, ease target Y back to ground
        const cs = cameraStateRef.current;
        cs.target.y += (0 - cs.target.y) * 0.05;
      }

      updateCam();

      // Update label positions via direct DOM manipulation
      AGENTS.forEach(a => {
        const mesh = agentMeshesRef.current[a.id];
        if (!mesh) return;
        let el = labelElemsRef.current[a.id];
        if (!el && labelContainerRef.current) {
          el = document.createElement("div");
          el.style.cssText = `position:absolute;pointer-events:none;padding:3px 8px;background:rgba(10,10,15,0.85);border:1px solid ${hexToCSS(a.color)}40;border-radius:4px;font-family:'Courier New',monospace;font-size:10px;font-weight:600;color:#e0e0e8;display:flex;align-items:center;gap:4px;white-space:nowrap;transform:translate(-50%,-100%);will-change:left,top;`;
          const dot = document.createElement("span");
          dot.className = "status-dot";
          dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${a.status === "working" ? "#14f195" : "#ffaa22"};flex-shrink:0;`;
          el.appendChild(dot);
          el.appendChild(document.createTextNode(a.name));
          labelContainerRef.current.appendChild(el);
          labelElemsRef.current[a.id] = el;
        }
        if (el) {
          const pos = new THREE.Vector3(mesh.position.x, 1.7, mesh.position.z);
          pos.project(camera);
          const x = (pos.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          const y = (-pos.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          el.style.left = x + "px";
          el.style.top = y + "px";
          // Update status dot color
          const dot = el.querySelector(".status-dot");
          const status = agentsRef.current.find(ag => ag.id === a.id)?.status || "idle";
          if (dot) dot.style.background = status === "working" ? "#14f195" : "#ffaa22";
        }
      });

      // Update agent screens
      const elapsed = clock.elapsedTime;
      AGENTS.forEach(a => updateScreen(a.id, elapsed));

      // Update wall trading charts
      updateWallScreens(elapsed);

      // Cafeteria ambient animations
      steamPuffs.forEach((puff) => {
        const pu = puff.userData;
        pu.rise += dt * pu.speed;
        if (pu.rise > 1.1) pu.rise = 0;
        puff.position.x = pu.baseX + Math.sin(elapsed * 2.2 + pu.sway) * 0.06;
        puff.position.z = pu.baseZ + Math.cos(elapsed * 1.8 + pu.sway) * 0.05;
        puff.position.y = pu.baseY + pu.rise * 0.9;
        const s = 0.65 + pu.rise * 1.4;
        puff.scale.setScalar(s);
        puff.material.opacity = Math.max(0, 0.34 - pu.rise * 0.26);
      });
      machineLight.material.emissiveIntensity = 1 + (Math.sin(elapsed * 4.5) * 0.35 + 0.35);
      fridgeCoolGlow.material.emissiveIntensity = 0.45 + (Math.sin(elapsed * 2) * 0.25 + 0.25);
      fridgeLeds.forEach((led, idx) => {
        const pulse = Math.sin(elapsed * (3.2 + idx * 0.8) + led.userData.phase);
        led.material.emissiveIntensity = 0.4 + Math.max(0, pulse) * 1.2;
      });

      // Animate game balls — only when both players are at the table
      let ppPlayingCount = 0;
      let bilPlayingCount = 0;
      Object.values(agentTargetsRef.current).forEach(t => {
        if (t.playing && t.gameSpotIdx >= 0) {
          const spot = allGameSpots[t.gameSpotIdx];
          if (spot?.game === "pingpong") ppPlayingCount++;
          if (spot?.game === "billiards") bilPlayingCount++;
        }
      });
      const ppActive = ppPlayingCount >= 2;
      const bilActive = bilPlayingCount >= 2;

      // Ping pong ball — bounces back and forth across the table
      ppBall.visible = ppActive;
      if (ppActive) {
        const t = elapsed * 3;
        ppBall.position.x = sportsX + Math.sin(t) * 1.0; // side to side
        ppBall.position.z = sportsZ + 3 + Math.sin(t * 1.7) * 0.3; // slight drift
        ppBall.position.y = 0.9 + Math.abs(Math.sin(t * 2)) * 0.3; // bouncing arc
      }

      // Billiard balls — slow rolling movement when playing
      billiardBalls.forEach((ball, i) => {
        ball.visible = bilActive;
        if (bilActive) {
          const t = elapsed * 0.4 + i * 2;
          const phase = Math.sin(t);
          // Balls slowly drift and settle
          if (i === billiardBalls.length - 1) {
            // Cue ball — moves more dramatically
            ball.position.x = ball.userData.baseX + Math.sin(elapsed * 0.8) * 0.4;
            ball.position.z = ball.userData.baseZ + Math.cos(elapsed * 0.6) * 0.3;
          } else {
            // Other balls — gentle rolling
            ball.position.x = ball.userData.baseX + Math.sin(t) * 0.15;
            ball.position.z = ball.userData.baseZ + Math.cos(t * 0.7) * 0.1;
          }
          ball.position.y = 0.9;
          ball.rotation.x += dt * (i + 1) * 0.5;
          ball.rotation.z += dt * (i + 1) * 0.3;
        }
      });

      renderer.render(scene, camera);
    }

    animate();

    // Mouse handlers — left drag = pan, right drag = rotate, scroll = zoom
    const el = renderer.domElement;
    const onDown = (e) => {
      dragRef.current = { dragging: true, button: e.button, prevX: e.clientX, prevY: e.clientY };
    };
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.prevX;
      const dy = e.clientY - dragRef.current.prevY;
      const cs = cameraStateRef.current;

      if (dragRef.current.button === 0) {
        // Left drag = pan (move target) — also breaks follow
        followAgentRef.current = null;
        const panSpeed = cs.distance * 0.0008;
        const angle = cs.angle;
        // Pan relative to camera orientation
        cs.target.x -= (Math.sin(angle) * dx + Math.cos(angle) * dy) * panSpeed;
        cs.target.z += (Math.cos(angle) * dx - Math.sin(angle) * dy) * panSpeed;
      } else if (dragRef.current.button === 2) {
        // Right drag = rotate horizontal + vertical
        cs.angle += dx * 0.002;
        cs.pitch = Math.max(0.1, Math.min(1.2, cs.pitch - dy * 0.002));
      }

      dragRef.current.prevX = e.clientX;
      dragRef.current.prevY = e.clientY;
    };
    const onUp = () => { dragRef.current.dragging = false; };
    const onWheel = (e) => {
      cameraStateRef.current.distance += e.deltaY * 0.02;
      cameraStateRef.current.distance = Math.max(3, Math.min(50, cameraStateRef.current.distance));
    };
    const onContext = (e) => { e.preventDefault(); }; // prevent right-click menu
    const onClick = (e) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Check monitor clicks first
      const allMonitorMeshes = [];
      Object.entries(monitorMeshes).forEach(([agentId, meshes]) => {
        meshes.forEach(m => allMonitorMeshes.push(m));
      });
      const monitorHits = raycaster.intersectObjects(allMonitorMeshes, false);
      if (monitorHits.length > 0 && monitorHits[0].object.userData.agentId) {
        setMonitorModal(monitorHits[0].object.userData.agentId);
        return;
      }

      // Then check agent clicks
      let closest = null, closestDist = Infinity;
      AGENTS.forEach(a => {
        const mesh = agentMeshesRef.current[a.id];
        if (!mesh) return;
        const ints = raycaster.intersectObjects(mesh.children, true);
        if (ints.length > 0 && ints[0].distance < closestDist) {
          closestDist = ints[0].distance;
          closest = a;
        }
      });
      if (closest) {
        if (followAgentRef.current === closest.id) {
          followAgentRef.current = null;
          setSelectedAgent(null);
        } else {
          followAgentRef.current = closest.id;
          setSelectedAgent(closest.id);
          cameraStateRef.current.distance = 3;
        }
      } else {
        followAgentRef.current = null;
        setSelectedAgent(null);
      }
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("wheel", onWheel);
    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", onContext);

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", onContext);
      window.removeEventListener("resize", onResize);
      Object.values(labelElemsRef.current).forEach(e => e.remove());
      labelElemsRef.current = {};
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Resize renderer when panel opens/closes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = canvasRef.current;
      const renderer = rendererRef.current;
      if (container && renderer) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
      }
    }, 320); // wait for CSS transition to finish
    return () => clearTimeout(timer);
  }, [panelOpen]);

  // Simulated agent activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => {
        const updated = [...prev];
        const idx = Math.floor(Math.random() * updated.length);
        if (Math.random() > 0.6) {
          updated[idx] = { ...updated[idx], status: updated[idx].status === "working" ? "idle" : "working" };
          const mesh = agentMeshesRef.current[updated[idx].id];
          if (mesh?.userData.ring) {
            mesh.userData.ring.material.color.set(updated[idx].status === "working" ? 0x14f195 : 0xffaa22);
          }
        }
        return updated;
      });
      const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const tmpl = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
      setActivityLog(prev => [{ time: timeStr(), ...tmpl(a) }, ...prev].slice(0, 50));
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatLog]);

  const assignTask = useCallback(() => {
    if (!taskInput.trim()) return;
    const agentId = taskAgent || AGENTS[Math.floor(Math.random() * AGENTS.length)].id;
    const agent = agents.find(a => a.id === agentId) || agents[0];
    const task = { id: Date.now(), agent: agent.name, agentId, desc: taskInput, status: "pending" };
    setTasks(prev => [task, ...prev]);
    setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: `assigned: ${taskInput}` }, ...prev]);
    setTaskInput("");

    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "running" } : t));
      setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: "started executing task" }, ...prev]);
    }, 1000);

    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "done" } : t));
      setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: `completed: ${taskInput}` }, ...prev]);
    }, 4000 + Math.random() * 3000);
  }, [taskInput, taskAgent, agents]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatLog(prev => [...prev, { from: "You", text: chatInput, color: "#e0e0e8" }]);
    const msg = chatInput;
    setChatInput("");
    setTimeout(() => {
      const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const resp = CHAT_RESPONSES[Math.floor(Math.random() * CHAT_RESPONSES.length)];
      setChatLog(prev => [...prev, { from: a.name, text: resp, color: hexToCSS(a.color) }]);
    }, 800 + Math.random() * 1200);
  }, [chatInput]);

  const chatMsgEndRef = useRef(null);
  useEffect(() => { chatMsgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistories, chatAgent]);

  const sendAgentChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistories(prev => ({
      ...prev,
      [chatAgent]: [...(prev[chatAgent] || []), { from: "You", text: msg, time: timeStr() }]
    }));

    const agent = AGENTS.find(a => a.id === chatAgent);
    const lower = msg.toLowerCase();

    // Helper to reset agent from any current activity
    function resetAgent(agentId) {
      const t = agentTargetsRef.current[agentId];
      const m = agentMeshesRef.current[agentId];
      if (!t) return;
      // Free sofa seat
      if (t.sofaSeatIdx >= 0) { /* occupiedSofaSeats managed in useEffect scope */ }
      // Free game spot
      if (t.gameSpotIdx >= 0) { /* occupiedGameSpots managed in useEffect scope */ }
      t.sitting = false; t.goToDesk = false; t.commanded = false;
      t.sofaSitting = false; t.goToSofa = false; t.sofaSeatIdx = -1;
      t.cafeSitting = false; t.goToCafe = false; t.cafeSpotIdx = -1; t.cafeTimer = 0;
      t.gyming = false; t.goToGym = false; t.gymSpotIdx = -1; t.gymTimer = 0; t.gymActivity = "";
      t.playing = false; t.goToGame = false; t.gameSpotIdx = -1; t.playTimer = 0;
      if (m) {
        m.position.y = 0;
        const ud = m.userData;
        if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
        if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
        if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
        if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
      }
    }

    // Detect commands
    const sitKeywords = ["go to desk", "go to your desk", "work", "start working", "go work"];
    const standKeywords = ["stand", "stand up", "get up", "walk", "go walk", "stop", "leave", "move around"];
    const sofaKeywords = ["sofa", "couch", "relax", "chill", "take a break", "rest", "lounge"];
    const cafeteriaKeywords = ["cafeteria", "cafe", "coffee", "coffee break", "eat", "snack", "food", "lunch"];
    const gymKeywords = ["gym", "workout", "exercise", "train", "training", "fitness"];
    const gymEquipmentMap = [
      { keys: ["treadmill", "run"], idx: [0, 1] },
      { keys: ["elliptical"], idx: [2] },
      { keys: ["bike", "cycle"], idx: [3] },
      { keys: ["chest press", "chestpress"], idx: [4] },
      { keys: ["power rack", "squat rack", "squat"], idx: [5] },
      { keys: ["bench", "bench press", "benchpress"], idx: [6] },
      { keys: ["ab wheel", "abs"], idx: [7] },
      { keys: ["punch", "punching bag", "boxing"], idx: [8] },
      { keys: ["kettlebell", "kettle bell"], idx: [9] },
      { keys: ["dumbbell", "dumbbells"], idx: [10] },
      { keys: ["barbell", "barbells"], idx: [11] },
      { keys: ["trampoline", "jump"], idx: [12] },
    ];
    const pingpongKeywords = ["ping pong", "pingpong", "table tennis", "play ping"];
    const billiardKeywords = ["billiard", "pool", "play pool", "shoot pool", "play billiard"];

    const isSitCommand = sitKeywords.some(k => lower.includes(k));
    const isStandCommand = standKeywords.some(k => lower.includes(k));
    const isSofaCommand = sofaKeywords.some(k => lower.includes(k));
    const isCafeteriaCommand = cafeteriaKeywords.some(k => lower.includes(k));
    const isGymCommand = gymKeywords.some(k => lower.includes(k));
    const isPingPongCommand = pingpongKeywords.some(k => lower.includes(k));
    const isBilliardCommand = billiardKeywords.some(k => lower.includes(k));

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function pickGymSpotFromMessage(text) {
      for (const row of gymEquipmentMap) {
        if (row.keys.some(k => text.includes(k))) return pickRandom(row.idx);
      }
      return Math.floor(Math.random() * 13);
    }

    if (isSitCommand) {
      // Send agent to their desk (commanded — won't auto-stand)
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.goToDesk = true;
        target.commanded = true;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Copy that. Heading to my desk now.", time: timeStr() }]
        }));
      }, 600);
    } else if (isSofaCommand) {
      // Send agent to sofa
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        // Find a free sofa seat — try from sofaSeatsRef or just set goToSofa
        target.goToSofa = true;
        target.sofaSeatIdx = -1; // will be assigned in movement loop
        // Find any free seat
        for (let i = 0; i < 8; i++) {
          target.sofaSeatIdx = i;
          break;
        }
        target.sofaSitTimer = 999; // commanded — stay until told otherwise
        target.commanded = true;
        target.timer = 999;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Sure thing. Going to relax on the sofa.", time: timeStr() }]
        }));
      }, 600);
    } else if (isCafeteriaCommand) {
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.goToCafe = true;
        target.cafeSpotIdx = Math.floor(Math.random() * 6);
        target.cafeTimer = 999;
        target.cafePhase = 0;
        target.commanded = true;
        target.timer = 999;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "On it. Heading to the cafeteria now.", time: timeStr() }]
        }));
      }, 600);
    } else if (isGymCommand || gymEquipmentMap.some(row => row.keys.some(k => lower.includes(k)))) {
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.goToGym = true;
        target.gymSpotIdx = pickGymSpotFromMessage(lower);
        target.gymTimer = 999;
        target.gymPhase = 0;
        target.commanded = true;
        target.timer = 999;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Got it. Going to the gym now.", time: timeStr() }]
        }));
      }, 600);
    } else if (isPingPongCommand || isBilliardCommand) {
      // Send agent to play — find a partner
      const gameName = isPingPongCommand ? "pingpong" : "billiards";
      const gameLabel = isPingPongCommand ? "ping pong" : "pool";

      // Find a free partner
      const freeAgents = Object.entries(agentTargetsRef.current).filter(([otherId, ot]) => {
        return otherId !== chatAgent && !ot.sitting && !ot.goToDesk && !ot.sofaSitting && !ot.goToSofa && !ot.cafeSitting && !ot.goToCafe && !ot.gyming && !ot.goToGym && !ot.playing && !ot.goToGame;
      });

      // Get the right spots (0,1 for pingpong, 2,3 for billiards)
      const spotOffset = isPingPongCommand ? 0 : 2;

      if (freeAgents.length > 0) {
        const [partnerId, partnerTarget] = freeAgents[Math.floor(Math.random() * freeAgents.length)];
        const partnerAgent = AGENTS.find(a => a.id === partnerId);
        const playTime = Math.random() * 30 + 30;

        resetAgent(chatAgent);
        resetAgent(partnerId);

        const target = agentTargetsRef.current[chatAgent];
        target.goToGame = true;
        target.gameSpotIdx = spotOffset;
        target.playTimer = playTime;
        target.playPhase = 0;
        target.timer = 999;

        partnerTarget.goToGame = true;
        partnerTarget.gameSpotIdx = spotOffset + 1;
        partnerTarget.playTimer = playTime;
        partnerTarget.playPhase = Math.PI;
        partnerTarget.timer = 999;

        setTimeout(() => {
          setChatHistories(prev => ({
            ...prev,
            [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: `Let's go! Invited ${partnerAgent?.name || "someone"} for a game of ${gameLabel}.`, time: timeStr() }]
          }));
        }, 600);
      } else {
        setTimeout(() => {
          setChatHistories(prev => ({
            ...prev,
            [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: `I'd love to play ${gameLabel}, but everyone's busy right now.`, time: timeStr() }]
          }));
        }, 600);
      }
    } else if (isStandCommand) {
      // Make agent stop whatever and walk
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.timer = Math.random() * 10 + 5;
        const mesh = agentMeshesRef.current[chatAgent];
        if (mesh) {
          // Move to open area
          mesh.position.x = 2 + (Math.random() - 0.5) * 4;
          mesh.position.z = (Math.random() - 0.5) * 4;
          mesh.position.y = 0;
          target.x = mesh.position.x + (Math.random() - 0.5) * 3;
          target.z = mesh.position.z + (Math.random() - 0.5) * 3;
        }
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Roger. Getting up and moving around.", time: timeStr() }]
        }));
      }, 600);
    } else {
      // Normal chat response
      setTimeout(() => {
        const resp = CHAT_RESPONSES[Math.floor(Math.random() * CHAT_RESPONSES.length)];
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: resp, time: timeStr() }]
        }));
      }, 800 + Math.random() * 1500);
    }
  }, [chatInput, chatAgent]);


  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0f", overflow: "hidden", position: "relative" }}>
      <div ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
      <div ref={labelContainerRef} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }} />

      {/* TOP LEFT CAMERA CONTROLS */}
      <div style={{
        position: "fixed", top: 0, left: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 16px 0", border: "1px solid #2a2520", borderTop: "none", borderLeft: "none",
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px"
      }}>
        {/* Reset/overview angle */}
        <div onClick={() => { followAgentRef.current = null; setSelectedAgent(null); cameraStateRef.current.angle = Math.PI / 4; cameraStateRef.current.distance = 25; cameraStateRef.current.target.set(0, 0, 0); }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </div>
        {/* Front view */}
        <div onClick={() => { cameraStateRef.current.angle = Math.PI / 2; }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        {/* Isometric/3D view */}
        <div onClick={() => { cameraStateRef.current.angle = Math.PI / 4; }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>

      {/* TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 16px 16px", border: "1px solid #2a2520", borderTop: "none",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 28px 12px", gap: 8, minWidth: 500
      }}>
        {/* Title with decorative lines */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, #c8a050)" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 600, fontSize: 13, letterSpacing: 6, color: "#c8a050" }}>
            0xMerl HEADQUARTERS
          </span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, #c8a050)" }} />
        </div>

        {/* Agent chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {agents.map(a => (
            <div key={a.id} onClick={() => {
              if (followAgentRef.current === a.id) {
                followAgentRef.current = null;
                setSelectedAgent(null);
              } else {
                followAgentRef.current = a.id;
                setSelectedAgent(a.id);
                cameraStateRef.current.distance = 3;
              }
            }} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 12px",
              background: selectedAgent === a.id ? "rgba(200,160,80,0.15)" : "rgba(30,28,24,0.8)",
              border: `1px solid ${selectedAgent === a.id ? "#c8a050" : "#3a3530"}`,
              borderRadius: 20, cursor: "pointer", transition: "all 0.2s"
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: hexToCSS(a.color), flexShrink: 0,
                boxShadow: `0 0 6px ${hexToCSS(a.color)}60`
              }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#d4c5a0", fontFamily: "'Courier New', monospace" }}>{a.name}</span>
              <div style={{ display: "flex", gap: 5, marginLeft: 2 }}>
                <span style={{ fontSize: 9, color: "#5a5545", cursor: "pointer" }}>👁</span>
                <span style={{ fontSize: 9, color: "#5a5545", cursor: "pointer" }}>💬</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TOP RIGHT ICONS */}
      <div style={{
        position: "fixed", top: 0, right: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 0 16px", border: "1px solid #2a2520", borderTop: "none", borderRight: "none",
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px"
      }}>
        {/* Map icon */}
        <div onClick={() => setMapOpen(prev => !prev)} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${mapOpen ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: mapOpen ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mapOpen ? "#c8a050" : "#6a6055"} strokeWidth="1.8">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
        </div>
        {/* Edit/pencil icon */}
        <div style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        {/* Volume/mute icon */}
        <div onClick={toggleMusic} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${musicPlaying ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: musicPlaying ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          {musicPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          )}
        </div>
      </div>

      {/* RIGHT SIDE VERTICAL TABS */}
      <div style={{
        position: "fixed", top: "50%", right: 0, transform: "translateY(-50%)", zIndex: 106,
        display: "flex", flexDirection: "column", gap: 6
      }}>
        <div onClick={() => { setHqPanelOpen(p => !p); setChatPanelOpen(false); }} style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace",
          color: hqPanelOpen ? "#0a0a0f" : "#c8a050",
          background: hqPanelOpen ? "#c8a050" : "rgba(10,10,15,0.88)",
          backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          transform: hqPanelOpen ? "translateX(-380px)" : "translateX(0)",
          opacity: chatPanelOpen ? 0 : 1, pointerEvents: chatPanelOpen ? "none" : "auto",
        }}>OPEN HQ</div>
        <div style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace", color: "#9945ff",
          background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          opacity: (hqPanelOpen || chatPanelOpen) ? 0 : 1, pointerEvents: (hqPanelOpen || chatPanelOpen) ? "none" : "auto",
        }}>MARKETPLACE</div>
        <div style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace", color: "#00d1ff",
          background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          opacity: (hqPanelOpen || chatPanelOpen) ? 0 : 1, pointerEvents: (hqPanelOpen || chatPanelOpen) ? "none" : "auto",
        }}>ANALYTICS</div>
      </div>

      {/* OPEN HQ PANEL */}
      <div style={{
        position: "fixed", top: 80, right: hqPanelOpen ? 0 : -380, bottom: 40, width: 380, zIndex: 105,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderRight: "none",
        borderRadius: "16px 0 0 16px",
        display: "flex", flexDirection: "column", transition: "right 0.3s ease",
        fontFamily: "'Courier New', monospace", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#14f195", letterSpacing: 2, marginBottom: 4 }}>HEADQUARTERS</div>
          <div style={{ fontSize: 10, color: "#6a6055" }}>Monitor outputs, runs, and schedules.</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2a2520", padding: "0 20px" }}>
          {["inbox", "history", "playbooks"].map(tab => (
            <div key={tab} onClick={() => setHqTab(tab)} style={{
              padding: "10px 16px", fontSize: 10, letterSpacing: 1.5, fontWeight: 600,
              textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s",
              color: hqTab === tab ? "#e0e0e8" : "#6a6055",
              background: hqTab === tab ? "rgba(0,209,255,0.1)" : "transparent",
              borderRadius: hqTab === tab ? "6px 6px 0 0" : 0,
              borderBottom: hqTab === tab ? "2px solid #00d1ff" : "2px solid transparent",
            }}>{tab}</div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {hqTab === "inbox" && (
            <div>
              <div style={{ fontSize: 10, color: "#6a6055", textAlign: "center", padding: "40px 0" }}>No new messages in inbox.</div>
            </div>
          )}

          {hqTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { agent: "Alpha", action: "Swapped 2 SOL → USDC on Jupiter", time: "2 min ago", status: "success" },
                { agent: "Echo", action: "Executed DCA buy order #47", time: "5 min ago", status: "success" },
                { agent: "Charlie", action: "Scanned 12 new token launches", time: "8 min ago", status: "success" },
                { agent: "Bravo", action: "Rebalanced portfolio allocation", time: "12 min ago", status: "success" },
                { agent: "Delta", action: "NFT floor price check — Tensor", time: "15 min ago", status: "success" },
                { agent: "Foxtrot", action: "Flagged suspicious transfer", time: "20 min ago", status: "warning" },
              ].map((h, i) => (
                <div key={i} style={{
                  padding: "10px 14px", background: "rgba(30,28,24,0.6)", border: "1px solid #2a2520",
                  borderRadius: 8, borderLeft: `3px solid ${h.status === "warning" ? "#ffaa22" : "#14f195"}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#c8a050" }}>{h.agent}</span>
                    <span style={{ fontSize: 9, color: "#4a4540" }}>{h.time}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#9a9590", lineHeight: 1.4 }}>{h.action}</div>
                </div>
              ))}
            </div>
          )}

          {hqTab === "playbooks" && (
            <div>
              {/* Playbooks header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 4 }}>PLAYBOOKS</div>
                  <div style={{ fontSize: 10, color: "#4a4540" }}>Launch reusable schedules for the whole headquarters.</div>
                </div>
                <button style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                  background: "transparent", color: "#00d1ff", border: "1px solid #00d1ff",
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: 1
                }}>REFRESH</button>
              </div>

              {/* Active jobs */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 8 }}>ACTIVE JOBS</div>
                <div style={{ fontSize: 10, color: "#4a4540", padding: "8px 0" }}>No active playbooks yet.</div>
              </div>

              {/* Separator */}
              <div style={{ height: 1, background: "#2a2520", marginBottom: 16 }} />

              {/* Templates */}
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 12 }}>TEMPLATES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { title: "DAILY MORNING BRIEFING", desc: "Every day at 9am. Summarize priorities, blockers, and what changed overnight.", color: "#c8a050" },
                  { title: "NIGHTLY CODE REVIEW DIGEST", desc: "Every night at midnight. Review the day and summarize risky changes or regressions.", color: "#c8a050" },
                  { title: "HOURLY HEALTH CHECK", desc: "Every 60 minutes. Report runtime health, failures, and anything that needs intervention.", color: "#00d1ff" },
                  { title: "WEEKLY PROGRESS REPORT", desc: "Every Monday at 8am. Roll up wins, unfinished work, and next steps.", color: "#14f195" },
                  { title: "CONTINUOUS MONITOR", desc: "Every 15 minutes. Watch for drift, silent failures, or anything unusual.", color: "#9945ff" },
                ].map((t, i) => (
                  <div key={i} style={{
                    padding: "14px 16px", background: "rgba(30,28,24,0.6)",
                    border: "1px solid #2a2520", borderRadius: 10,
                    borderLeft: `3px solid ${t.color}`, cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e0e0e8", letterSpacing: 1, marginBottom: 6 }}>{t.title}</div>
                    <div style={{ fontSize: 10, color: "#6a6055", lineHeight: 1.5 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM LEFT STATUS BAR */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 16px 0 0", border: "1px solid #2a2520", borderBottom: "none", borderLeft: "none",
        display: "flex", alignItems: "center", padding: "10px 24px", gap: 12,
        fontFamily: "'Courier New', monospace", fontSize: 10, color: "#6a6055"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#14f195" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#14f195", boxShadow: "0 0 6px #14f195" }} />
          CONNECTED
        </span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.status === "working").length} working</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.status === "idle").length} idle</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#c8a050" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></svg>
          quiet
        </span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>drag · scroll · space+drag · dbl-click</span>
      </div>

      {/* BOTTOM RIGHT CHAT BUTTON */}
      <button onClick={() => { setChatPanelOpen(p => !p); setHqPanelOpen(false); }} style={{
        position: "fixed", bottom: chatPanelOpen ? 460 : 0, right: 0, zIndex: 110,
        background: chatPanelOpen ? "#c8a050" : "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: chatPanelOpen ? "10px 10px 0 0" : "16px 0 0 0",
        border: `1px solid ${chatPanelOpen ? "#c8a050" : "#2a2520"}`, borderBottom: "none", borderRight: "none",
        display: "flex", alignItems: "center", gap: 8, padding: "10px 24px",
        fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 600,
        color: chatPanelOpen ? "#0a0a0f" : "#c8a050", cursor: "pointer", letterSpacing: 1,
        transition: "all 0.3s ease"
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chatPanelOpen ? "#0a0a0f" : "#c8a050"} strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        CHAT
      </button>

      {/* CHAT PANEL */}
      <div style={{
        position: "fixed", bottom: chatPanelOpen ? 0 : -460, right: 0, zIndex: 105,
        width: 520, height: 460,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderBottom: "none", borderRight: "none",
        borderRadius: "16px 0 0 0",
        display: "flex", transition: "bottom 0.3s ease",
        fontFamily: "'Courier New', monospace"
      }}>
        {/* Agent list sidebar */}
        <div style={{
          width: 140, borderRight: "1px solid #2a2520", display: "flex", flexDirection: "column",
          padding: "14px 0", overflowY: "auto"
        }}>
          <div style={{ padding: "0 14px 10px", fontSize: 10, color: "#6a6055", fontWeight: 600, letterSpacing: 2 }}>
            AGENTS <span style={{ color: "#4a4540", marginLeft: 6 }}>{AGENTS.length}</span>
          </div>
          {AGENTS.map(a => (
            <div key={a.id} onClick={() => setChatAgent(a.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              cursor: "pointer", transition: "all 0.15s",
              background: chatAgent === a.id ? "rgba(200,160,80,0.1)" : "transparent",
              borderLeft: chatAgent === a.id ? "2px solid #c8a050" : "2px solid transparent",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: a.status === "working" ? "#14f195" : "#6a6055", flexShrink: 0
              }} />
              <span style={{ fontSize: 11, color: chatAgent === a.id ? "#e0e0e8" : "#6a6055" }}>{a.name}</span>
            </div>
          ))}
        </div>

        {/* Chat conversation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          {(() => {
            const agent = AGENTS.find(a => a.id === chatAgent);
            return (
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid #2a2520",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: agent ? hexToCSS(agent.color) : "#555",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#0a0a0f", fontWeight: 700
                }}>{agent?.name?.[0]}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e8" }}>{agent?.name}</div>
                  <div style={{ fontSize: 9, color: "#6a6055" }}>{agent?.role}</div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setChatHistories(prev => ({ ...prev, [chatAgent]: [] }))} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: "#c8a050", color: "#0a0a0f", border: "none", cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: 0.5
                }}>New session</button>
                <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid #2a2520", cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {(chatHistories[chatAgent] || []).length === 0 && (
              <div style={{ textAlign: "center", color: "#4a4540", fontSize: 10, padding: "40px 0" }}>
                Start a conversation with this agent
              </div>
            )}
            {(chatHistories[chatAgent] || []).map((m, i) => {
              const isYou = m.from === "You";
              const agent = AGENTS.find(a => a.id === chatAgent);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isYou ? "flex-end" : "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {!isYou && <span style={{ fontSize: 9, fontWeight: 600, color: agent ? hexToCSS(agent.color) : "#c8a050" }}>{m.from}</span>}
                    {isYou && <span style={{ fontSize: 9, fontWeight: 600, color: "#6a6055" }}>You</span>}
                    <span style={{ fontSize: 8, color: "#4a4540" }}>{m.time}</span>
                  </div>
                  <div style={{
                    padding: "8px 12px", maxWidth: "80%", fontSize: 11, lineHeight: 1.5,
                    borderRadius: isYou ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    background: isYou ? "rgba(200,160,80,0.15)" : "rgba(40,38,34,0.8)",
                    border: `1px solid ${isYou ? "#3a3520" : "#2a2520"}`,
                    color: "#d4d0c8"
                  }}>{m.text}</div>
                </div>
              );
            })}
            <div ref={chatMsgEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 16px 6px", borderTop: "1px solid #2a2520", display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAgentChat()}
              placeholder="type a message"
              style={{
                flex: 1, background: "rgba(30,28,24,0.8)", border: "1px solid #2a2520", borderRadius: 8,
                padding: "10px 14px", color: "#e0e0e8", fontFamily: "inherit", fontSize: 11, outline: "none"
              }} />
            <button onClick={sendAgentChat} style={{
              background: "#c8a050", color: "#0a0a0f", border: "none", borderRadius: 8,
              padding: "10px 18px", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>Send</button>
          </div>
          {/* Model selector row */}
          <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <select style={{
              background: "rgba(30,28,24,0.8)", border: "1px solid #2a2520", borderRadius: 6,
              padding: "5px 10px", color: "#c8a050", fontFamily: "inherit", fontSize: 10, outline: "none", cursor: "pointer"
            }}>
              <option>GPT-4.1 mini</option>
              <option>GPT-4o</option>
              <option>Claude Sonnet</option>
              <option>Llama 3</option>
              <option>DeepSeek</option>
            </select>
            <span style={{ fontSize: 9, color: "#4a4540", cursor: "pointer" }}>Show</span>
            <span style={{ fontSize: 9, color: "#4a4540", cursor: "pointer" }}>Tools</span>
          </div>
        </div>
      </div>

      {/* MINIMAP */}
      {mapOpen && (
        <div onClick={() => setMapOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 560, height: 420, background: "#0a0f0a", border: "2px solid rgba(200,160,80,0.25)",
            borderRadius: 16, overflow: "hidden", boxShadow: "0 0 40px rgba(200,160,80,0.1)",
            display: "flex", flexDirection: "column", fontFamily: "'Courier New', monospace"
          }}>
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, background: "rgba(200,160,80,0.08)", borderBottom: "1px solid rgba(200,160,80,0.2)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e8" }}>HQ FLOOR MAP</div>
                <div style={{ fontSize: 10, color: "#6a6055" }}>Live agent positions</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ padding: "4px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: "rgba(20,241,149,0.15)", color: "#14f195", letterSpacing: 1 }}>LIVE</div>
              <div onClick={() => setMapOpen(false)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520" }}>×</div>
            </div>
            <div style={{ flex: 1, padding: 16, background: "#060a06" }}>
              <svg viewBox="-36 -9 85 68" width="100%" height="100%" style={{ borderRadius: 6 }}>
                {Array.from({length: 86}, (_, i) => i - 36).map(x => (<line key={`gx${x}`} x1={x} y1="-9" x2={x} y2="59" stroke="rgba(20,241,149,0.04)" strokeWidth="0.05"/>))}
                {Array.from({length: 69}, (_, i) => i - 9).map(z => (<line key={`gz${z}`} x1="-36" y1={z} x2="49" y2={z} stroke="rgba(20,241,149,0.04)" strokeWidth="0.05"/>))}
                <rect x="-9" y="-7" width="18" height="14" fill="rgba(20,241,149,0.03)" stroke="rgba(20,241,149,0.15)" strokeWidth="0.08"/>
                <rect x={LEFT_GYM_X-8} y={LEFT_GYM_Z-7} width="16" height="14" fill="rgba(255,120,120,0.03)" stroke="rgba(255,120,120,0.2)" strokeWidth="0.08"/>
                <rect x={SPORTS_X-6} y={SPORTS_Z-7} width="12" height="14" fill="rgba(200,160,80,0.03)" stroke="rgba(200,160,80,0.15)" strokeWidth="0.08"/>
                <rect x={BOTTOM_ROOM_X-6} y={BOTTOM_ROOM_Z-7} width="12" height="14" fill="rgba(100,210,255,0.03)" stroke="rgba(100,210,255,0.16)" strokeWidth="0.08"/>
                <rect x={LEFT_GYM_X-4.2} y={LEFT_GYM_Z+3.7} width="6.8" height="1.2" fill="rgba(255,120,120,0.12)" stroke="rgba(255,120,120,0.35)" strokeWidth="0.06" rx="0.08"/>
                <text x={LEFT_GYM_X-0.8} y={LEFT_GYM_Z+4.45} fill="rgba(255,150,150,0.9)" fontSize="0.5" textAnchor="middle" opacity="0.9">CARDIO</text>
                <rect x={LEFT_GYM_X+4.4} y={LEFT_GYM_Z+0.8} width="1.6" height="1" fill="rgba(255,200,120,0.14)" stroke="rgba(255,200,120,0.35)" strokeWidth="0.06" rx="0.08"/>
                <text x={LEFT_GYM_X+5.2} y={LEFT_GYM_Z+1.6} fill="rgba(255,200,120,0.9)" fontSize="0.42" textAnchor="middle" opacity="0.9">CHEST</text>
                <rect x={LEFT_GYM_X-1.8} y={LEFT_GYM_Z-2.0} width="4.2" height="1.8" fill="rgba(255,180,120,0.14)" stroke="rgba(255,180,120,0.35)" strokeWidth="0.06" rx="0.08"/>
                <text x={LEFT_GYM_X+0.3} y={LEFT_GYM_Z-0.75} fill="rgba(255,180,120,0.9)" fontSize="0.45" textAnchor="middle" opacity="0.9">RACK/BENCH</text>
                <circle cx={LEFT_GYM_X+2.2} cy={LEFT_GYM_Z-3.9} r="1" fill="rgba(255,107,107,0.14)" stroke="rgba(255,107,107,0.35)" strokeWidth="0.06"/>
                <text x={LEFT_GYM_X+2.2} y={LEFT_GYM_Z-2.8} fill="rgba(255,130,130,0.9)" fontSize="0.42" textAnchor="middle" opacity="0.9">TRAMP</text>
                {[[-6,-5],[-3,-5],[0,-5],[-6,-2],[-3,-2],[0,-2]].map(([x,z],i) => (<rect key={`d${i}`} x={x-0.6} y={z-0.35} width="1.2" height="0.7" fill="rgba(20,241,149,0.1)" stroke="rgba(20,241,149,0.25)" strokeWidth="0.04" rx="0.05"/>))}
                <circle cx="-5" cy="4" r="1.5" fill="rgba(20,241,149,0.06)" stroke="rgba(20,241,149,0.2)" strokeWidth="0.04"/>
                <rect x="3.8" y="2.6" width="2.4" height="0.8" fill="rgba(153,69,255,0.15)" stroke="rgba(153,69,255,0.3)" strokeWidth="0.04" rx="0.1"/>
                <rect x="3.8" y="5.1" width="2.4" height="0.8" fill="rgba(153,69,255,0.15)" stroke="rgba(153,69,255,0.3)" strokeWidth="0.04" rx="0.1"/>
                <rect x={SPORTS_X-1.3} y={SPORTS_Z-3.7} width="2.6" height="1.4" fill="rgba(10,92,42,0.4)" stroke="rgba(20,241,149,0.3)" strokeWidth="0.06" rx="0.1"/>
                <text x={SPORTS_X} y={SPORTS_Z-2.8} fill="#14f195" fontSize="0.5" textAnchor="middle" opacity="0.6">POOL</text>
                <rect x={SPORTS_X-1.1} y={SPORTS_Z+2.4} width="2.2" height="1.2" fill="rgba(26,85,51,0.4)" stroke="rgba(20,241,149,0.3)" strokeWidth="0.06" rx="0.05"/>
                <text x={SPORTS_X} y={SPORTS_Z+3.2} fill="#14f195" fontSize="0.5" textAnchor="middle" opacity="0.6">PONG</text>
                <rect x={BOTTOM_ROOM_X-2.8} y={BOTTOM_ROOM_Z+5.1} width="5.6" height="1.1" fill="rgba(100,210,255,0.18)" stroke="rgba(100,210,255,0.35)" strokeWidth="0.06" rx="0.1"/>
                <text x={BOTTOM_ROOM_X} y={BOTTOM_ROOM_Z+5.8} fill="rgba(100,210,255,0.8)" fontSize="0.5" textAnchor="middle" opacity="0.9">COUNTER</text>
                <circle cx={BOTTOM_ROOM_X-2.1} cy={BOTTOM_ROOM_Z+1.3} r="0.9" fill="rgba(190,150,90,0.18)" stroke="rgba(190,150,90,0.35)" strokeWidth="0.06"/>
                <circle cx={BOTTOM_ROOM_X+2.1} cy={BOTTOM_ROOM_Z+1.3} r="0.9" fill="rgba(190,150,90,0.18)" stroke="rgba(190,150,90,0.35)" strokeWidth="0.06"/>
                <circle cx={BOTTOM_ROOM_X} cy={BOTTOM_ROOM_Z-2.2} r="0.9" fill="rgba(190,150,90,0.18)" stroke="rgba(190,150,90,0.35)" strokeWidth="0.06"/>
                <text x={BOTTOM_ROOM_X} y={BOTTOM_ROOM_Z-1.1} fill="rgba(190,150,90,0.8)" fontSize="0.5" textAnchor="middle" opacity="0.8">SEATING</text>
                <rect x={BOTTOM_ROOM_X-5.6} y={BOTTOM_ROOM_Z+4.2} width="1" height="0.8" fill="rgba(124,199,255,0.2)" stroke="rgba(124,199,255,0.45)" strokeWidth="0.06" rx="0.05"/>
                <text x={BOTTOM_ROOM_X-5.1} y={BOTTOM_ROOM_Z+5.35} fill="rgba(124,199,255,0.85)" fontSize="0.45" textAnchor="middle" opacity="0.9">FRIDGE</text>
                <rect x="7.9" y="-6.3" width="0.6" height="2.6" fill="rgba(20,241,149,0.08)" stroke="rgba(20,241,149,0.2)" strokeWidth="0.04"/>
                <text x="0" y="-7.8" fill="rgba(20,241,149,0.5)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">MAIN OFFICE</text>
                <text x={LEFT_GYM_X} y={LEFT_GYM_Z-7.8} fill="rgba(255,120,120,0.7)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">FITNESS GYM</text>
                <text x={SPORTS_X} y={SPORTS_Z-7.8} fill="rgba(200,160,80,0.5)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">SPORTS ROOM</text>
                <text x={BOTTOM_ROOM_X} y={BOTTOM_ROOM_Z-7.8} fill="rgba(100,210,255,0.7)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">CAFETERIA</text>
                {AGENTS.map(a => {
                  const mesh = agentMeshesRef.current[a.id];
                  if (!mesh) return null;
                  const r = (a.color >> 16) & 0xff, g = (a.color >> 8) & 0xff, b = a.color & 0xff;
                  return (<g key={a.id}><circle cx={mesh.position.x} cy={mesh.position.z} r="0.6" fill={`rgb(${r},${g},${b})`} opacity="0.12"/><circle cx={mesh.position.x} cy={mesh.position.z} r="0.3" fill={`rgb(${r},${g},${b})`} opacity="0.9"/><text x={mesh.position.x} y={mesh.position.z + 0.9} fill="#e0e0e8" fontSize="0.5" textAnchor="middle" fontFamily="monospace">{a.name}</text></g>);
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* MONITOR MODAL */}
      {monitorModal && (() => {
        const agent = AGENTS.find(a => a.id === monitorModal);
        if (!agent) return null;
        const msgs = {
          alpha: ["Scanning Jupiter routes...", "SOL/USDC spread: 0.02%", "Executing swap: 2 SOL → USDC", "TX confirmed: 5xK7m...9pQ2", "P&L today: +0.34 SOL", "Checking orderbook depth...", "Route: SOL→USDC via Raydium", "Slippage: 0.1%", "Balance: 12.4 SOL"],
          bravo: ["Analyzing yield farms...", "APY comparison: Marinade 7.2%", "Rebalancing portfolio...", "Moving 30% to stables", "Risk score: LOW", "DeFi TVL: $4.2B", "Staking rewards claimed", "New farm detected: mSOL/USDC"],
          cipher: ["Querying on-chain data...", "Parsing 1,247 transactions", "Anomaly detected: wallet 0x8f..", "Generating report...", "Clustering whale wallets...", "Data pipeline: HEALTHY", "Top holder moved 500K USDC", "Network TPS: 3,847"],
          delta: ["Scanning NFT floors...", "Tensor: Mad Lads 12.4 SOL", "New collection: Claynosaurz", "Rarity analysis complete", "Listing snipe ready", "Watching 3 collections", "Floor change: -0.3 SOL", "Volume 24h: 2,100 SOL"],
          echo: ["TX queue: 3 pending", "Sending 0.5 SOL → 7xQ...", "Confirmed in 412ms", "Priority fee: 0.000005 SOL", "Batch TX: 5/5 complete", "Nonce account updated", "Compute units: 200,000", "Retry count: 0"],
          flux: ["Market feed active", "SOL: $168.42 (+2.1%)", "Volume spike detected: RAY", "Alert: BTC dominance ↓ 52%", "Monitoring 47 pairs", "Sentiment analysis: BULLISH", "Funding rate: +0.01%", "Open interest: $2.1B"],
        };
        const agentMsgs = msgs[monitorModal] || ["..."];
        return (
          <div onClick={() => setMonitorModal(null)} style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 560, height: 420, background: "#0a0f0a",
              border: `2px solid ${hexToCSS(agent.color)}40`,
              borderRadius: 16, overflow: "hidden", boxShadow: `0 0 40px ${hexToCSS(agent.color)}20`,
              display: "flex", flexDirection: "column", fontFamily: "'Courier New', monospace"
            }}>
              {/* Modal header */}
              <div style={{
                padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
                background: `${hexToCSS(agent.color)}15`, borderBottom: `1px solid ${hexToCSS(agent.color)}30`
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: hexToCSS(agent.color),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#0a0a0f"
                }}>{agent.name[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e8" }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: "#6a6055" }}>{agent.role}</div>
                </div>
                <div style={{ flex: 1 }} />
                {(() => {
                  const target = agentTargetsRef.current[monitorModal];
                  const isAtDesk = target && target.sitting;
                  return (
                    <div style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600,
                      background: isAtDesk ? "rgba(20,241,149,0.15)" : "rgba(255,170,34,0.15)",
                      color: isAtDesk ? "#14f195" : "#ffaa22",
                      letterSpacing: 1
                    }}>{isAtDesk ? "RUNNING" : "IDLE"}</div>
                  );
                })()}
                <div onClick={() => setMonitorModal(null)} style={{
                  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 6, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520"
                }}>×</div>
              </div>

              {/* Live terminal */}
              <MonitorTerminal agentId={monitorModal} agent={agent} messages={agentMsgs} agents={agents} agentTargets={agentTargetsRef} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Live terminal component for monitor modal
function MonitorTerminal({ agentId, agent, messages, agents, agentTargets }) {
  const [lines, setLines] = useState([]);
  const bottomRef = useRef(null);
  const [isAtDesk, setIsAtDesk] = useState(false);

  // Check sitting state every 500ms
  useEffect(() => {
    const check = setInterval(() => {
      const target = agentTargets?.current?.[agentId];
      setIsAtDesk(target?.sitting || false);
    }, 500);
    return () => clearInterval(check);
  }, [agentId, agentTargets]);

  // Only add terminal lines when agent is at desk
  useEffect(() => {
    if (!isAtDesk) return;
    // Boot message when agent sits down
    if (lines.length === 0) {
      setLines([
        { text: `[${agent.name.toUpperCase()}] Terminal initialized`, type: "system" },
        { text: `Connected to solana-mainnet-beta`, type: "system" },
        { text: `Agent status: ONLINE`, type: "system" },
        { text: `---`, type: "divider" },
      ]);
    }
    const interval = setInterval(() => {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
      const types = ["output", "output", "output", "success", "info", "warning"];
      const type = types[Math.floor(Math.random() * types.length)];
      setLines(prev => [...prev.slice(-40), { text: msg, type, ts }]);
    }, 1500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [isAtDesk, messages, agent.name]);

  // Clear lines when agent leaves desk
  useEffect(() => {
    if (!isAtDesk) {
      setLines([]);
    }
  }, [isAtDesk]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const colors = {
    system: "#6a6055",
    output: "#14f195",
    success: "#14f195",
    info: "#00d1ff",
    warning: "#ffaa22",
    divider: "#2a2520",
  };

  if (!isAtDesk) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#050805", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>💤</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#4a4540", marginBottom: 8, fontFamily: "'Courier New', monospace" }}>Screen Idle</div>
        <div style={{ fontSize: 11, color: "#333330", textAlign: "center", lineHeight: 1.6, fontFamily: "'Courier New', monospace" }}>
          {agent.name} is not at their desk.<br />
          Terminal will activate when the agent returns.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", background: "#060a06" }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, marginBottom: 4,
          fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.6
        }}>
          {line.ts && <span style={{ color: "#3a3530", flexShrink: 0 }}>{line.ts}</span>}
          {line.type === "divider" ? (
            <span style={{ color: "#2a2520" }}>{"─".repeat(40)}</span>
          ) : (
            <span style={{ color: colors[line.type] || "#14f195" }}>
              <span style={{ color: "#4a4540", marginRight: 6 }}>{">"}</span>
              {line.text}
            </span>
          )}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <span style={{ color: "#4a4540", fontFamily: "'Courier New', monospace", fontSize: 12 }}>{">"}</span>
        <span style={{
          width: 8, height: 14, background: "#14f195",
          animation: "blink 1s step-end infinite", display: "inline-block"
        }} />
        <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
