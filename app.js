/* =========================================================
   AIR GUITAR OPERA
   FINAL LEFT / RIGHT ALIGNMENT + PERFORMANCE VERSION

   Important behavior:
   - Camera image and MediaPipe coordinates are calibrated.
   - Screen-left hand always controls the cyan chord field.
   - Screen-right hand always controls the pink guitar field.
   - MediaPipe Left/Right labels are intentionally ignored.
   - Design and acoustic-guitar engine remain unchanged.
========================================================= */

const el = (id) =>
  document.getElementById(id);

const welcome = el("welcome");
const stage = el("stage");

const startBtn = el("startBtn");
const startMsg = el("startMsg");

const video = el("video");
const fxCanvas = el("fx");
const handsCanvas = el("handsCanvas");

const fx = fxCanvas.getContext("2d");
const hc = handsCanvas.getContext("2d");

const leftField = el("leftField");
const rightField = el("rightField");

const chordName = el("chordName");
const chordLong = el("chordLong");
const playedNote = el("playedNote");

const leftEnergy = el("leftEnergy");
const rightEnergy = el("rightEnergy");

const cameraState = el("cameraState");
const handState = el("handState");

const message = el("message");
const subMessage = el("subMessage");
const progressBar = el("progressBar");

const manualBtn = el("manualBtn");
const concertBtn = el("concertBtn");
const pauseBtn = el("pauseBtn");

const volume = el("volume");
const volumeText = el("volumeText");

const errorBox = el("error");

/* =========================================================
   STATE
========================================================= */

let camera = null;
let hands = null;

let audioCtx = null;
let player = null;
let output = null;

let instrumentReady = false;

let mode = "manual";

let concertTimer = null;
let concertPaused = false;
let concertStep = 0;

let selectedChord = 0;

let lastHandSeen = 0;

let lastRight = null;
let lastRightTime = 0;
let lastPlay = 0;

let leftIn = false;
let rightIn = false;

let leftPower = 0;
let rightPower = 0;

let particles = [];

let mediaPipeBusy = false;
let lastMediaPipeFrame = 0;

let animationStarted = false;

let smoothScreenLeftPoint = null;
let smoothScreenRightPoint = null;

/*
  The correct orientation is detected automatically
  from the video element after the camera starts.

  true means MediaPipe X must be inverted to match
  the visible camera image.
*/

let invertMediaPipeX = false;

/*
  0.82 keeps the hand responsive.
  Smaller values create more smoothing but more delay.
*/

const HAND_SMOOTHING = 0.82;

/* =========================================================
   INTERACTION ZONES
========================================================= */

const LEFT_ZONE = {
  x1: 0.05,
  x2: 0.25,
  y1: 0.32,
  y2: 0.80
};

const RIGHT_ZONE = {
  x1: 0.42,
  x2: 0.96,
  y1: 0.17,
  y2: 0.90
};

/* =========================================================
   MUSIC
========================================================= */

const CHORDS = [
  {
    name: "C MAJOR",
    shortName: "C",
    notes: [48, 52, 55, 60, 64]
  },
  {
    name: "A MINOR",
    shortName: "Am",
    notes: [45, 48, 52, 57, 60]
  },
  {
    name: "F MAJOR",
    shortName: "F",
    notes: [41, 45, 48, 53, 57]
  },
  {
    name: "G MAJOR",
    shortName: "G",
    notes: [43, 47, 50, 55, 59]
  }
];

const MELODY = [
  60,
  62,
  64,
  67,
  69,
  72,
  74,
  76,
  79
];

const PROGRESSION = [
  0,
  1,
  2,
  3,
  0,
  3,
  1,
  2
];

/* =========================================================
   GUITAR ENGINE
========================================================= */

function initInstrument() {
  if (instrumentReady) {
    if (
      audioCtx.state ===
      "suspended"
    ) {
      audioCtx.resume();
    }

    return true;
  }

  if (
    typeof WebAudioFontPlayer !==
      "function" ||

    typeof _tone_0250_LK_AcousticSteel_SF2_file ===
      "undefined"
  ) {
    showError(
      "The acoustic-guitar library did not load. Check the Internet connection."
    );

    return false;
  }

  audioCtx =
    new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

  player =
    new WebAudioFontPlayer();

  output =
    audioCtx.createGain();

  output.gain.value =
    Number(volume.value);

  output.connect(
    audioCtx.destination
  );

  player.loader.decodeAfterLoading(
    audioCtx,
    "_tone_0250_LK_AcousticSteel_SF2_file"
  );

  instrumentReady = true;

  return true;
}

function playNote(
  midi,
  velocity = 0.7,
  delay = 0,
  duration = 1.8
) {
  if (!initInstrument()) {
    return;
  }

  player.queueWaveTable(
    audioCtx,
    output,
    _tone_0250_LK_AcousticSteel_SF2_file,
    audioCtx.currentTime + delay,
    midi,
    duration,
    Math.min(0.95, velocity)
  );
}

function playChord(
  chordIndex = selectedChord,
  velocity = 0.75,
  upward = false
) {
  const chord =
    CHORDS[chordIndex];

  const notes =
    upward
      ? [...chord.notes].reverse()
      : chord.notes;

  notes.forEach(
    (midi, index) => {
      const stringDelay =
        index *
        (
          0.026 +
          (1 - velocity) *
          0.018
        );

      playNote(
        midi,
        velocity,
        stringDelay,
        2
      );
    }
  );

  selectedChord =
    chordIndex;

  chordName.textContent =
    chord.shortName;

  chordLong.textContent =
    chord.name;

  createParticles(
    window.innerWidth * 0.72,
    window.innerHeight * 0.48,
    "#ffd36b",
    15
  );
}

function stopSound() {
  if (player && audioCtx) {
    player.cancelQueue(
      audioCtx
    );
  }
}

/* =========================================================
   CONCERT MODE
========================================================= */

function playConcertStep() {
  if (
    mode !== "concert" ||
    concertPaused
  ) {
    return;
  }

  const chordIndex =
    PROGRESSION[
      concertStep %
      PROGRESSION.length
    ];

  playChord(
    chordIndex,
    0.72,
    concertStep % 2 === 1
  );

  window.setTimeout(() => {
    playNote(
      MELODY[
        (concertStep * 2) %
        MELODY.length
      ],
      0.42,
      0,
      1.35
    );
  }, 270);

  window.setTimeout(() => {
    playNote(
      MELODY[
        (
          concertStep * 2 +
          2
        ) %
        MELODY.length
      ],
      0.36,
      0,
      1.1
    );
  }, 560);

  concertStep += 1;

  progressBar.style.width =
    `${
      (
        concertStep %
        PROGRESSION.length
      ) /
      PROGRESSION.length *
      100
    }%`;

  message.textContent =
    "Guitar Concert is playing";

  subMessage.textContent =
    "Your right-side hand can improvise above the acoustic guitar arrangement";
}

function startConcert() {
  mode = "concert";

  manualBtn.classList.remove(
    "active"
  );

  concertBtn.classList.add(
    "active"
  );

  concertPaused = false;

  pauseBtn.textContent =
    "PAUSE";

  window.clearInterval(
    concertTimer
  );

  playConcertStep();

  concertTimer =
    window.setInterval(
      playConcertStep,
      900
    );
}

function setManualMode() {
  mode = "manual";

  manualBtn.classList.add(
    "active"
  );

  concertBtn.classList.remove(
    "active"
  );

  window.clearInterval(
    concertTimer
  );

  concertTimer = null;
  concertPaused = false;

  pauseBtn.textContent =
    "PAUSE";

  progressBar.style.width =
    "0%";

  stopSound();

  message.textContent =
    "Manual Live mode";

  subMessage.textContent =
    "Screen-left hand selects the chord. Screen-right hand performs the guitar.";
}

function toggleConcertPause() {
  if (mode !== "concert") {
    return;
  }

  concertPaused =
    !concertPaused;

  pauseBtn.textContent =
    concertPaused
      ? "RESUME"
      : "PAUSE";

  if (concertPaused) {
    window.clearInterval(
      concertTimer
    );

    concertTimer = null;

    stopSound();
  } else {
    playConcertStep();

    concertTimer =
      window.setInterval(
        playConcertStep,
        900
      );
  }
}

/* =========================================================
   CANVAS
========================================================= */

function resizeCanvases() {
  const ratio =
    Math.min(
      window.devicePixelRatio || 1,
      1.25
    );

  [
    fxCanvas,
    handsCanvas
  ].forEach((canvas) => {
    canvas.width =
      Math.round(
        window.innerWidth *
        ratio
      );

    canvas.height =
      Math.round(
        window.innerHeight *
        ratio
      );

    canvas.style.width =
      `${window.innerWidth}px`;

    canvas.style.height =
      `${window.innerHeight}px`;

    canvas
      .getContext("2d")
      .setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
      );
  });
}

/* =========================================================
   PARTICLES
========================================================= */

function createParticles(
  x,
  y,
  color,
  amount = 5
) {
  for (
    let index = 0;
    index < amount;
    index += 1
  ) {
    particles.push({
      x,
      y,

      velocityX:
        (Math.random() - 0.5) *
        4,

      velocityY:
        (Math.random() - 0.5) *
        4,

      life: 1,

      size:
        Math.random() *
        3 + 1,

      color
    });
  }

  if (particles.length > 180) {
    particles.splice(
      0,
      particles.length - 180
    );
  }
}

function animateParticles() {
  fx.clearRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  for (const particle of particles) {
    particle.x +=
      particle.velocityX;

    particle.y +=
      particle.velocityY;

    particle.velocityX *=
      0.98;

    particle.velocityY *=
      0.98;

    particle.life -=
      0.028;

    fx.globalAlpha =
      Math.max(
        0,
        particle.life
      );

    fx.fillStyle =
      particle.color;

    fx.beginPath();

    fx.arc(
      particle.x,
      particle.y,
      particle.size,
      0,
      Math.PI * 2
    );

    fx.fill();
  }

  fx.globalAlpha = 1;

  particles =
    particles.filter(
      (particle) =>
        particle.life > 0
    );

  window.requestAnimationFrame(
    animateParticles
  );
}

/* =========================================================
   CAMERA ORIENTATION CALIBRATION
========================================================= */

function detectVideoMirrorState() {
  const computedStyle =
    window.getComputedStyle(
      video
    );

  const transform =
    computedStyle.transform;

  /*
    A CSS matrix beginning with -1 means
    scaleX(-1) is active.
  */

  invertMediaPipeX =
    transform === "matrix(-1, 0, 0, 1, 0, 0)" ||
    transform.includes("-1, 0, 0, 1");

  console.log(
    "MediaPipe horizontal correction:",
    invertMediaPipeX
      ? "INVERTED"
      : "NORMAL"
  );
}

/* =========================================================
   COORDINATES
========================================================= */

function convertLandmark(
  landmark
) {
  const correctedX =
    invertMediaPipeX
      ? 1 - landmark.x
      : landmark.x;

  return {
    x:
      correctedX,

    y:
      landmark.y,

    screenX:
      correctedX *
      window.innerWidth,

    screenY:
      landmark.y *
      window.innerHeight
  };
}

function pointInsideZone(
  point,
  zone
) {
  return (
    point &&

    point.x >= zone.x1 &&
    point.x <= zone.x2 &&

    point.y >= zone.y1 &&
    point.y <= zone.y2
  );
}

/* =========================================================
   SMOOTHING
========================================================= */

function smoothPoint(
  previousPoint,
  newPoint
) {
  if (!newPoint) {
    return null;
  }

  if (!previousPoint) {
    return {
      ...newPoint
    };
  }

  return {
    x:
      previousPoint.x *
      (1 - HAND_SMOOTHING) +
      newPoint.x *
      HAND_SMOOTHING,

    y:
      previousPoint.y *
      (1 - HAND_SMOOTHING) +
      newPoint.y *
      HAND_SMOOTHING,

    screenX:
      previousPoint.screenX *
      (1 - HAND_SMOOTHING) +
      newPoint.screenX *
      HAND_SMOOTHING,

    screenY:
      previousPoint.screenY *
      (1 - HAND_SMOOTHING) +
      newPoint.screenY *
      HAND_SMOOTHING
  };
}

/* =========================================================
   DRAW HAND
========================================================= */

function drawHand(
  landmarks,
  color
) {
  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [0, 17]
  ];

  hc.save();

  hc.strokeStyle =
    color;

  hc.fillStyle =
    "#ffffff";

  hc.lineWidth =
    1.8;

  hc.shadowBlur =
    4;

  hc.shadowColor =
    color;

  for (
    const [
      startIndex,
      endIndex
    ] of connections
  ) {
    const start =
      convertLandmark(
        landmarks[startIndex]
      );

    const end =
      convertLandmark(
        landmarks[endIndex]
      );

    hc.beginPath();

    hc.moveTo(
      start.screenX,
      start.screenY
    );

    hc.lineTo(
      end.screenX,
      end.screenY
    );

    hc.stroke();
  }

  for (
    const landmark of landmarks
  ) {
    const point =
      convertLandmark(
        landmark
      );

    hc.beginPath();

    hc.arc(
      point.screenX,
      point.screenY,
      2.8,
      0,
      Math.PI * 2
    );

    hc.fill();
  }

  hc.restore();
}

/* =========================================================
   INTERACTION

   Critical rule:
   Hands are assigned by visible screen position.

   Left side of screen:
   chord control.

   Right side of screen:
   guitar performance.

   MediaPipe's Left/Right labels are not used.
========================================================= */

function updateInteraction(
  screenLeftPoint,
  screenRightPoint
) {
  const chordPoint =
    pointInsideZone(
      screenLeftPoint,
      LEFT_ZONE
    )
      ? screenLeftPoint

      : pointInsideZone(
          screenRightPoint,
          LEFT_ZONE
        )
        ? screenRightPoint
        : null;

  const guitarPoint =
    pointInsideZone(
      screenRightPoint,
      RIGHT_ZONE
    )
      ? screenRightPoint

      : pointInsideZone(
          screenLeftPoint,
          RIGHT_ZONE
        )
        ? screenLeftPoint
        : null;

  leftIn =
    Boolean(chordPoint);

  rightIn =
    Boolean(guitarPoint);

  if (chordPoint) {
    const relativeY =
      Math.max(
        0,

        Math.min(
          0.999,

          (
            chordPoint.y -
            LEFT_ZONE.y1
          ) /
          (
            LEFT_ZONE.y2 -
            LEFT_ZONE.y1
          )
        )
      );

    const chordIndex =
      Math.floor(
        relativeY * 4
      );

    if (
      chordIndex !==
      selectedChord
    ) {
      selectedChord =
        chordIndex;

      chordName.textContent =
        CHORDS[
          chordIndex
        ].shortName;

      chordLong.textContent =
        CHORDS[
          chordIndex
        ].name;

      playNote(
        CHORDS[
          chordIndex
        ].notes[0],

        0.34,
        0,
        1.2
      );

      createParticles(
        chordPoint.screenX,
        chordPoint.screenY,
        "#59ecff",
        6
      );
    }

    leftPower =
      Math.min(
        100,
        leftPower + 9
      );

  } else {
    leftPower =
      Math.max(
        0,
        leftPower - 13
      );
  }

  if (guitarPoint) {
    if (lastRight) {
      const now =
        performance.now();

      const deltaX =
        guitarPoint.x -
        lastRight.x;

      const deltaY =
        guitarPoint.y -
        lastRight.y;

      const elapsed =
        Math.max(
          16,
          now -
          lastRightTime
        );

      const speed =
        Math.hypot(
          deltaX,
          deltaY
        ) /
        elapsed *
        1000;

      if (
        speed > 0.31 &&
        now - lastPlay > 135
      ) {
        playChord(
          selectedChord,

          Math.min(
            0.92,

            Math.max(
              0.4,
              speed * 0.72
            )
          ),

          deltaY < 0
        );

        playedNote.textContent =
          "STRUM";

        lastPlay =
          now;
      }

      else if (
        speed > 0.095 &&
        speed <= 0.31 &&
        now - lastPlay > 190
      ) {
        const melodyIndex =
          Math.max(
            0,

            Math.min(
              MELODY.length - 1,

              Math.floor(
                (
                  1 -
                  guitarPoint.y
                ) *
                MELODY.length
              )
            )
          );

        playNote(
          MELODY[
            melodyIndex
          ],

          Math.min(
            0.62,

            Math.max(
              0.3,
              speed + 0.25
            )
          ),

          0,
          1.4
        );

        playedNote.textContent =
          "LIVE NOTE";

        lastPlay =
          now;
      }

      rightPower =
        Math.min(
          100,
          speed * 118
        );

      if (
        Math.random() <
        0.25
      ) {
        createParticles(
          guitarPoint.screenX,
          guitarPoint.screenY,
          "#f15ee8",
          2
        );
      }
    }

    lastRight = {
      x:
        guitarPoint.x,

      y:
        guitarPoint.y
    };

    lastRightTime =
      performance.now();

  } else {
    lastRight =
      null;

    lastRightTime =
      0;

    rightPower =
      Math.max(
        0,
        rightPower - 16
      );

    playedNote.textContent =
      mode === "concert"
        ? "Add live notes"
        : "Move to play";
  }

  leftField.classList.toggle(
    "active",
    leftIn
  );

  rightField.classList.toggle(
    "active",
    rightIn
  );

  leftEnergy.style.width =
    `${leftPower}%`;

  rightEnergy.style.width =
    `${rightPower}%`;

  if (mode === "manual") {
    if (leftIn && rightIn) {
      message.textContent =
        "Harmony selected. Perform with the screen-right hand.";

      subMessage.textContent =
        "Fast movement strums. Gentle movement plays individual notes.";
    }

    else if (leftIn) {
      message.textContent =
        "Choose a chord in the cyan field";

      subMessage.textContent =
        "Move vertically through C, Am, F and G";
    }

    else if (rightIn) {
      message.textContent =
        "The pink guitar field is active";

      subMessage.textContent =
        "Move faster for a stronger acoustic strum";
    }

    else {
      message.textContent =
        "Place one hand in the cyan chord field";

      subMessage.textContent =
        "Then place another hand in the pink guitar field";
    }
  }
}

/* =========================================================
   MEDIAPIPE RESULTS
========================================================= */

function handleResults(
  results
) {
  hc.clearRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  const detectedHands =
    results.multiHandLandmarks ||
    [];

  if (
    detectedHands.length === 0
  ) {
    handState.textContent =
      "NO HANDS";

    if (
      performance.now() -
      lastHandSeen >
      220
    ) {
      leftIn = false;
      rightIn = false;

      leftField.classList.remove(
        "active"
      );

      rightField.classList.remove(
        "active"
      );

      leftEnergy.style.width =
        "0%";

      rightEnergy.style.width =
        "0%";

      lastRight = null;

      smoothScreenLeftPoint =
        null;

      smoothScreenRightPoint =
        null;
    }

    return;
  }

  lastHandSeen =
    performance.now();

  handState.textContent =
    `${detectedHands.length} HAND${
      detectedHands.length > 1
        ? "S"
        : ""
    }`;

  /*
    Convert every hand into a palm point.
  */

  const handsWithPoints =
    detectedHands.map(
      (landmarks) => {
        const palmPoint =
          convertLandmark(
            landmarks[9]
          );

        return {
          landmarks,
          palmPoint
        };
      }
    );

  /*
    Sort from visible screen-left
    to visible screen-right.

    This is the important correction.
  */

  handsWithPoints.sort(
    (
      firstHand,
      secondHand
    ) =>
      firstHand.palmPoint.x -
      secondHand.palmPoint.x
  );

  let rawScreenLeftPoint =
    null;

  let rawScreenRightPoint =
    null;

  if (
    handsWithPoints.length === 1
  ) {
    const onlyHand =
      handsWithPoints[0];

    /*
      Color and assignment are based
      only on the visible position.
    */

    if (
      onlyHand.palmPoint.x <
      0.5
    ) {
      rawScreenLeftPoint =
        onlyHand.palmPoint;

      drawHand(
        onlyHand.landmarks,
        "#59ecff"
      );

    } else {
      rawScreenRightPoint =
        onlyHand.palmPoint;

      drawHand(
        onlyHand.landmarks,
        "#f15ee8"
      );
    }
  }

  else {
    const leftHandData =
      handsWithPoints[0];

    const rightHandData =
      handsWithPoints[
        handsWithPoints.length - 1
      ];

    rawScreenLeftPoint =
      leftHandData.palmPoint;

    rawScreenRightPoint =
      rightHandData.palmPoint;

    drawHand(
      leftHandData.landmarks,
      "#59ecff"
    );

    drawHand(
      rightHandData.landmarks,
      "#f15ee8"
    );
  }

  smoothScreenLeftPoint =
    smoothPoint(
      smoothScreenLeftPoint,
      rawScreenLeftPoint
    );

  smoothScreenRightPoint =
    smoothPoint(
      smoothScreenRightPoint,
      rawScreenRightPoint
    );

  updateInteraction(
    smoothScreenLeftPoint,
    smoothScreenRightPoint
  );
}

/* =========================================================
   MEDIAPIPE
========================================================= */

function initializeHands() {
  hands = new Hands({
    locateFile: (fileName) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${fileName}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,

    minDetectionConfidence:
      0.5,

    minTrackingConfidence:
      0.47,

    /*
      The visible video is not mirrored.
      Hand assignment is managed spatially.
    */

    selfieMode: false
  });

  hands.onResults(
    handleResults
  );
}

/* =========================================================
   CAMERA FRAME PROCESSING
========================================================= */

async function processFrame() {
  const now =
    performance.now();

  if (
    mediaPipeBusy ||
    now -
    lastMediaPipeFrame <
    42 ||
    !hands ||
    video.readyState < 2
  ) {
    return;
  }

  mediaPipeBusy = true;
  lastMediaPipeFrame = now;

  try {
    await hands.send({
      image: video
    });
  } catch (error) {
    console.warn(
      "MediaPipe frame skipped",
      error
    );
  } finally {
    mediaPipeBusy = false;
  }
}

/* =========================================================
   START CAMERA
========================================================= */

async function startExperience() {
  startBtn.disabled = true;

  startMsg.textContent =
    "Loading guitar samples and requesting camera permission...";

  try {
    if (!initInstrument()) {
      throw new Error(
        "Acoustic guitar samples did not load."
      );
    }

    initializeHands();

    camera =
      new Camera(video, {
        onFrame:
          processFrame,

        width: 640,
        height: 360
      });

    await camera.start();

    welcome.classList.add(
      "hidden"
    );

    stage.classList.remove(
      "hidden"
    );

    cameraState.textContent =
      "CAMERA ACTIVE";

    /*
      Determine orientation after
      the video has become visible.
    */

    window.requestAnimationFrame(
      () => {
        detectVideoMirrorState();
        resizeCanvases();
      }
    );

    if (!animationStarted) {
      animationStarted = true;
      animateParticles();
    }

  } catch (error) {
    console.error(error);

    startBtn.disabled = false;

    startMsg.textContent =
      error.message;

    showError(
      error.message
    );
  }
}

/* =========================================================
   RESTART CAMERA
========================================================= */

async function restartCamera() {
  stopSound();

  cameraState.textContent =
    "RESTARTING";

  mediaPipeBusy = false;
  lastMediaPipeFrame = 0;

  smoothScreenLeftPoint = null;
  smoothScreenRightPoint = null;

  try {
    if (camera) {
      await camera.stop();
    }

    if (video.srcObject) {
      video.srcObject
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );
    }

    camera =
      new Camera(video, {
        onFrame:
          processFrame,

        width: 640,
        height: 360
      });

    await camera.start();

    cameraState.textContent =
      "CAMERA ACTIVE";

    window.requestAnimationFrame(
      detectVideoMirrorState
    );

  } catch (error) {
    showError(
      "Unable to restart camera"
    );
  }
}

/* =========================================================
   ERROR
========================================================= */

function showError(text) {
  errorBox.textContent =
    text;

  errorBox.classList.remove(
    "hidden"
  );

  window.setTimeout(() => {
    errorBox.classList.add(
      "hidden"
    );
  }, 6000);
}

/* =========================================================
   EVENTS
========================================================= */

startBtn.onclick =
  startExperience;

manualBtn.onclick =
  setManualMode;

concertBtn.onclick =
  startConcert;

pauseBtn.onclick =
  toggleConcertPause;

el("stopBtn").onclick = () => {
  window.clearInterval(
    concertTimer
  );

  concertTimer = null;
  concertPaused = true;

  pauseBtn.textContent =
    "RESUME";

  stopSound();
};

el("restartBtn").onclick =
  restartCamera;

el("fullBtn").onclick = () => {
  if (
    document.fullscreenElement
  ) {
    document.exitFullscreen();
  } else {
    document
      .documentElement
      .requestFullscreen();
  }
};

volume.oninput = () => {
  const newVolume =
    Number(
      volume.value
    );

  volumeText.textContent =
    `${Math.round(
      newVolume * 100
    )}%`;

  if (
    output &&
    audioCtx
  ) {
    output.gain.setTargetAtTime(
      newVolume,
      audioCtx.currentTime,
      0.02
    );
  }
};

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) {
      stopSound();
    }
  }
);

window.addEventListener(
  "blur",
  stopSound
);

window.addEventListener(
  "resize",
  resizeCanvases
);

/* =========================================================
   INITIALIZATION
========================================================= */

resizeCanvases();
