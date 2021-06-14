"use strict";

// globals
const width = window.innerWidth;
const height = window.innerHeight;
const agent_count = 2000;
let trail = new Float32Array(width * height);

// config
const settings = {
  AGENT_SPEED: 0.5,
  regenerate_agents: true,
  DIFFUSSION_WEIGHTS: [
    1 / 9,
    1 / 9,
    1 / 9,
    1 / 9,
    1 / 9,
    1 / 9,
    1 / 9,
    1 / 9,
    1 / 9,
  ],
  DEPOSIT_AMOUNT: 1,
};

//helpers
function index(x, y) {
  return x + y * width;
}

onload = function () {
  // Set canvas dimensions to fullscreen
  const canvas = document.getElementById("simcanvas");
  canvas.width = width;
  canvas.height = height;
  const agents = [];

  function generate_agents() {
    // erases all agents, generates new random ones
    agents.splice(0, agents.length);
    for (let n = 0; n < agent_count; ++n) {
      agents.push({
        x: Math.random() * width,
        y: Math.random() * height,
        angle: Math.random() * 2 * Math.PI,
      });
    }
    settings.regenerate_agents = false;
  }

  function move_agents() {
    for (let agent of agents) {
      agent.x += settings.AGENT_SPEED * Math.sin(agent.angle);
      agent.y += settings.AGENT_SPEED * Math.cos(agent.angle);
      // add periodic boundary conditions
      if (agent.x < 0) agent.x += width;
      if (agent.x > width) agent.x = 0;
      if (agent.y < 0) agent.y += height;
      if (agent.y > height) agent.y = 0;
    }
  }

  function deposit() {
    for (let agent of agents) {
      const x = Math.round(agent.x);
      const y = Math.round(agent.y);
      trail[index(x, y)] = settings.DEPOSIT_AMOUNT;
    }
  }

  function render() {
    const ctx = canvas.getContext("2d");
    const trail_image = ctx.getImageData(0, 0, width, height);

    let i = 0;
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const value = trail[i];
        const brightness = Math.floor(value * 255);
        trail_image.data[i * 4 + 0] = brightness;
        trail_image.data[i * 4 + 1] = brightness;
        trail_image.data[i * 4 + 2] = brightness;
        trail_image.data[i * 4 + 3] = 255;
        i++;
      }
    }

    for (let agent of agents) {
      trail_image.data[
        (Math.floor(agent.x) + Math.floor(agent.y) * width) * 4 + 0
      ] = 255;
      trail_image.data[
        (Math.floor(agent.x) + Math.floor(agent.y) * width) * 4 + 1
      ] = 255;
      trail_image.data[
        (Math.floor(agent.x) + Math.floor(agent.y) * width) * 4 + 2
      ] = 255;
    }

    ctx.putImageData(trail_image, 0, 0);
  }

  function next_frame() {
    if (settings.regenerate_agents) {
      generate_agents();
    }
    move_agents();
    deposit();
    render(canvas, agents);

    window.requestAnimationFrame(next_frame);
  }
  next_frame();
};
