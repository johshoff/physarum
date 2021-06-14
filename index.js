"use strict";

// globals
const width = window.innerWidth;
const height = window.innerHeight;
const agent_count = 2000;

// config
let regenerate_agents = true;
const settings = {
  AGENT_SPEED: 0.2,
};

onload = function () {
  // Set canvas dimensions to fullscreen
  const canvas = document.getElementById("simcanvas");
  canvas.width = width;
  canvas.height = height;
  let i = 0;

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
    regenerate_agents = false;
  }

  function update_agents() {
    for (let agent of agents) {
      agent.x += settings.AGENT_SPEED * Math.sin(agent.angle);
      agent.y += settings.AGENT_SPEED * Math.cos(agent.angle);
    }
  }

  function next_frame() {
    if (regenerate_agents) {
      generate_agents();
    }
    update_agents();
    if (i < 5) {
      render(canvas, agents);
    }
    i++;
    window.requestAnimationFrame(next_frame);
  }
  next_frame();
};

function render(canvas, agents) {
  const ctx = canvas.getContext("2d");
  const trail_image = ctx.getImageData(0, 0, width, height);

  let i = 0;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      trail_image.data[i * 4 + 0] = 0;
      trail_image.data[i * 4 + 1] = 0;
      trail_image.data[i * 4 + 2] = 0;
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
