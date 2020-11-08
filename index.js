'use strict';

const num_agents = 10000;
const speed = 1.0;
const decay_factor = 0.99;
const sensor_distance = 1.5;
const sensor_angle = 40/360; // radians
const turning_speed = sensor_angle * 0.02;
const deposit_amount = 0.6;
// use a Gaussian kernel for diffusion
const weight = [
	1/16, 1/8, 1/16,
	 1/8, 1/4,  1/8,
	1/16, 1/8, 1/16,
];

// Update the state in place
function sim_step(agents, trail, width, height) {
	function index(x, y) {
		return x + y * width;
	}

	function step_sense_and_rotate() {
		for (let agent of agents) {
			function sense_relative_angle(theta) {
				return trail[index(
					Math.round(agent.x + Math.sin(agent.heading + theta) * sensor_distance),
					Math.round(agent.y + Math.cos(agent.heading + theta) * sensor_distance)
				)];
			}

			const sense_left   = sense_relative_angle(sensor_angle);
			const sense_middle = sense_relative_angle(0);
			const sense_right  = sense_relative_angle(-sensor_angle);

			if (sense_middle > sense_left && sense_middle > sense_right) {
				// no change
			} else if (sense_left > sense_right) {
				agent.heading += turning_speed;
			} else if (sense_right > sense_left) {
				agent.heading -= turning_speed;
			} else {
				agent.heading += (Math.random() * 2 - 1) * turning_speed;
			}
		}
	}

	function step_move() {
		for (let agent of agents) {
			agent.x += speed * Math.cos(agent.heading);
			agent.y += speed * Math.sin(agent.heading);
		}
	}

	function step_deposit() {
		for (let agent of agents) {
			const x = Math.round(agent.x);
			const y = Math.round(agent.y);
			if (x <= 0 || y <= 0 || x >= width-1 || y >= height-1)
				continue;
			trail[index(x, y)] += deposit_amount;
		}
	}

	function step_diffuse_and_decay() {
		let old_trail = Float32Array.from(trail);
		for (let y=1; y<height-1; ++y) {
			for (let x=1; x<width-1; ++x) {
				const diffused_value = (
					trail[index(x-1, y-1)] * weight[0] +
					trail[index(x  , y-1)] * weight[1] +
					trail[index(x+1, y-1)] * weight[2] +
					trail[index(x-1, y  )] * weight[3] +
					trail[index(x  , y  )] * weight[4] +
					trail[index(x+1, y  )] * weight[5] +
					trail[index(x-1, y+1)] * weight[6] +
					trail[index(x  , y+1)] * weight[7] +
					trail[index(x+1, y+1)] * weight[8]
				);

				trail[index(x, y)] = Math.min(1.0, diffused_value * decay_factor);
			}
		}
	}

	// Run steps shown in
	// https://payload.cargocollective.com/1/18/598881/13800048/diagram_670.jpg
	// Some steps are combined for speed and compactness
	step_sense_and_rotate();
	step_move();
	step_deposit();
	step_diffuse_and_decay();

	return trail;
}

function render(trail, canvas) {
	const width = canvas.width;
	const height = canvas.height;
	const ctx = canvas.getContext('2d');
	const trail_image = ctx.getImageData(0, 0, width, height);

	let i = 0;
	for (let y=0; y<height; ++y) {
		for (let x=0; x<width; ++x) {
			const value = trail[i];
			const brightness = Math.floor(value * 255);
			trail_image.data[i*4+0] = brightness;
			trail_image.data[i*4+1] = brightness;
			trail_image.data[i*4+2] = brightness;
			trail_image.data[i*4+3] = 255;
			i++;
		}
	}
	ctx.putImageData(trail_image, 0, 0);
}

onload = function() {
	const canvas = document.getElementById('simcanvas');
	const width = canvas.width;
	const height = canvas.height;

	const agents = [];
	for (let i=0; i<num_agents; ++i) {
		agents.push({
			x: Math.random() * width,
			y: Math.random() * height,
			heading: Math.random() * 2 * Math.PI, // radians
		});
	}

	let trail = new Float32Array(width * height);

	function next_frame() {
		trail = sim_step(agents, trail, width, height);
		render(trail, canvas);
		window.requestAnimationFrame(next_frame);
	}

	next_frame();
}
