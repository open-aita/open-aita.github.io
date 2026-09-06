
export function mount(root) {
  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Competition archive stream. Reuse the complete source records while omitting contributors.
  const awardStream = root.querySelector("[data-award-stream]");
  if (awardStream) {
    const viewport = awardStream.querySelector("[data-award-stream-viewport]");
    const toggle = awardStream.querySelector("[data-award-stream-toggle]");
    const count = awardStream.querySelector("[data-award-stream-count]");
    const records = [...root.querySelectorAll(".award-records li")].map((item) => {
      const levelNode = item.lastElementChild;
      return {
        index: item.firstElementChild?.textContent.trim() || "",
        title: item.querySelector("strong")?.textContent.trim() || "",
        level: levelNode?.tagName === "B" ? levelNode.textContent.trim() : ""
      };
    }).filter((record) => record.index && record.title && record.level);

    const getAwardTier = ({ title, level }) => {
      if (/国一|国二|国三|国赛/.test(level)) return "red";
      if (/省一|省二|省三|省奖|省级/.test(level)) return "purple";
      if (/校一|校二|校三|校级/.test(level)) return "blue";
      if (/院一|院二|院三|院级/.test(level)) return "green";
      if (/省赛|广东赛区|广东分赛|广东选拔赛|广东省|华南赛区|赛区/.test(title)) return "purple";
      if (/校际|校区|广东工业大学/.test(title)) return "blue";
      if (/国赛|全国|全球|世界/.test(title)) return "red";
      return "green";
    };
    const tierKeys = ["green", "blue", "purple", "red"];
    const streamCount = 6;
    const laneBuckets = Array.from({ length: streamCount }, () => (
      Object.fromEntries(tierKeys.map((tier) => [tier, []]))
    ));
    const tierPositions = Object.fromEntries(tierKeys.map((tier) => [tier, 0]));
    records.forEach((record) => {
      const tier = getAwardTier(record);
      const laneIndex = (tierKeys.indexOf(tier) + tierPositions[tier]) % laneBuckets.length;
      tierPositions[tier] += 1;
      laneBuckets[laneIndex][tier].push({ ...record, tier });
    });
    const lanes = laneBuckets.map((bucket, laneIndex) => {
      const tierStart = laneIndex % tierKeys.length;
      const tierOrder = [...tierKeys.slice(tierStart), ...tierKeys.slice(0, tierStart)];
      const mixedRecords = [];
      while (tierOrder.some((tier) => bucket[tier].length)) {
        tierOrder.forEach((tier) => {
          if (bucket[tier].length) mixedRecords.push(bucket[tier].shift());
        });
      }
      return mixedRecords;
    });

    const createToken = (record, tier) => {
      const token = doc.createElement("span");
      token.className = `award-code-token award-code-token--${tier}`;
      const title = doc.createElement("span");
      const level = doc.createElement("em");
      title.textContent = record.title;
      level.textContent = record.level;
      token.append(title, level);
      return token;
    };

    if (viewport && records.length) {
      const fragment = doc.createDocumentFragment();
      lanes.forEach((sourceRecords, laneIndex) => {
        if (!sourceRecords.length) return;
        const visualRecords = [...sourceRecords];

        const lane = doc.createElement("div");
        lane.className = "award-code-lane";
        const laneWindow = doc.createElement("div");
        laneWindow.className = "award-code-window";
        const track = doc.createElement("div");
        track.className = "award-code-track";
        const characterCount = visualRecords.reduce((total, record) => (
          total + record.title.length + record.level.length + 10
        ), 0);
        const duration = Math.max(90, Math.min(190, characterCount * .22));
        track.style.setProperty("--award-stream-duration", `${Math.round(duration)}s`);
        track.style.setProperty("--award-stream-delay", `${Math.round(-duration * laneIndex * .19)}s`);

        const createSequence = () => {
          const sequence = doc.createElement("div");
          sequence.className = "award-code-sequence";
          visualRecords.forEach((record) => sequence.append(createToken(record, record.tier)));
          return sequence;
        };
        track.append(createSequence());
        if (!reduceMotion) track.append(createSequence());
        laneWindow.append(track);
        lane.append(laneWindow);
        fragment.append(lane);
      });
      viewport.replaceChildren(fragment);
      if (count) count.textContent = String(records.length).padStart(2, "0");

      if (toggle && !reduceMotion) {
        toggle.hidden = false;
        toggle.addEventListener("click", () => {
          const paused = awardStream.classList.toggle("is-paused");
          toggle.setAttribute("aria-pressed", String(paused));
          toggle.textContent = paused ? "RESUME FLOW" : "PAUSE FLOW";
        });
      }
      if ("IntersectionObserver" in window && !reduceMotion) {
        const awardStreamObserver = new IntersectionObserver(([entry]) => {
          awardStream.classList.toggle("is-offscreen", !entry.isIntersecting);
        }, { rootMargin: "20% 0px", threshold: 0 });
        awardStreamObserver.observe(awardStream);
      }
    }
  }

}
