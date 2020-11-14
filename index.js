'use strict';

const num_agents = 10000;
const highlight_agents = false;
const show_stats = false;
const speed = 1.0;
const decay_factor = 0.95;
const sensor_distance = 2;
const sensor_angle = 40/180*Math.PI; // radians
const turning_speed = sensor_angle;
const random_turning = false; // randomly turn within the limits of turning_speed
const deposit_amount = 0.6;
const wrap_around = true;
const start_in_circle = false; // otherwise start randomly
// use a Gaussian kernel for diffusion
const weight = [
	1/16, 1/8, 1/16,
	 1/8, 1/4,  1/8,
	1/16, 1/8, 1/16,
];
let counts = [0,0,0,0];

// Update the state in place
function sim_step(agents, trail, width, height) {
	function index(x, y) {
		return x + y * width;
	}

	function step_sense_and_rotate() {
		for (let agent of agents) {
			function sense_relative_angle(theta) {
				return trail[index(
					Math.round(agent.x + Math.cos(agent.heading + theta) * sensor_distance),
					Math.round(agent.y + Math.sin(agent.heading + theta) * sensor_distance)
				)];
			}

			const sense_left   = sense_relative_angle(sensor_angle);
			const sense_middle = sense_relative_angle(0);
			const sense_right  = sense_relative_angle(-sensor_angle);

			const modified_turning = (random_turning ? (Math.random() * 0.5 + 0.5) : 1) * turning_speed;
			let option = -1;
			if (sense_middle > sense_left && sense_middle > sense_right) {
				// no change
				option = 0;
			} else if (sense_left > sense_right) {
				option = 1;
				agent.heading += modified_turning;
			} else if (sense_right > sense_left) {
				option = 2;
				agent.heading -= modified_turning;
			} else {
				option = 3;
				agent.heading += Math.round(Math.random() * 2 - 1) * turning_speed;
			}
			counts[option] += 1
			agent.last_option = option;
		}
	}

	function step_move() {
		for (let agent of agents) {
			agent.x += speed * Math.cos(agent.heading);
			agent.y += speed * Math.sin(agent.heading);
			if (wrap_around) {
				agent.x = (agent.x + width) % width;
				agent.y = (agent.y + height) % height;
			}
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
					old_trail[index(x-1, y-1)] * weight[0] +
					old_trail[index(x  , y-1)] * weight[1] +
					old_trail[index(x+1, y-1)] * weight[2] +
					old_trail[index(x-1, y  )] * weight[3] +
					old_trail[index(x  , y  )] * weight[4] +
					old_trail[index(x+1, y  )] * weight[5] +
					old_trail[index(x-1, y+1)] * weight[6] +
					old_trail[index(x  , y+1)] * weight[7] +
					old_trail[index(x+1, y+1)] * weight[8]
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

function render(trail, canvas, agents) {
	const width = canvas.width;
	const height = canvas.height;
	const ctx = canvas.getContext('2d');
	const trail_image = ctx.getImageData(0, 0, width, height);

	const max_brightness = highlight_agents ? 128 : 255;
	let i = 0;
	for (let y=0; y<height; ++y) {
		for (let x=0; x<width; ++x) {
			const value = trail[i];
			const brightness = Math.floor(value * max_brightness);
			trail_image.data[i*4+0] = brightness;
			trail_image.data[i*4+1] = brightness;
			trail_image.data[i*4+2] = brightness;
			trail_image.data[i*4+3] = 255;
			i++;
		}
	}
	if (highlight_agents) {
		for (let agent of agents) {
			let color = [0,0,0];
			switch (agent.last_option) {
				case 0: color = [100,  0,  0]; break; // straight
				case 1: color = [  0,100,  0]; break; // right
				case 2: color = [  0,  0,100]; break; // left
				case 3: color = [255,255,255]; break; // indecisive
			}
			trail_image.data[(Math.floor(agent.x)+Math.floor(agent.y)*width)*4+0] = color[0];
			trail_image.data[(Math.floor(agent.x)+Math.floor(agent.y)*width)*4+1] = color[1];
			trail_image.data[(Math.floor(agent.x)+Math.floor(agent.y)*width)*4+2] = color[2];
		}
	}
	ctx.putImageData(trail_image, 0, 0);
}

onload = function() {
	const canvas = document.getElementById('simcanvas');
	const width = canvas.width;
	const height = canvas.height;

	const agents = [];
	if (start_in_circle) {
		const radius = Math.min(width, height) * 0.2;
		for (let i=0; i<num_agents; ++i) {
			const t = 2 * Math.PI*i/num_agents;
			agents.push({
				x: Math.cos(t) * radius + width / 2,
				y: Math.sin(t) * radius + height / 2,
				heading: t - Math.PI / 2,
			});
		}
	} else {
		for (let i=0; i<num_agents; ++i) {
			agents.push({
				x: Math.random() * width,
				y: Math.random() * height,
				heading: Math.random() * 2 * Math.PI, // radians
			});
		}
	}

	let trail = new Float32Array(width * height);

	function next_frame() {
		trail = sim_step(agents, trail, width, height);
		render(trail, canvas, agents);
		window.requestAnimationFrame(next_frame);

		if (show_stats) {
			let sum = 0;
			for (let c of counts) {
				sum += c;
			}
			let t = 'Straight, right, left, random: '
			for (let c of counts) {
				t += Math.round(c/sum*100)+'%, ';
			}
			stats.innerText = t;
		}
	}

	next_frame();

	skip = function(num_frames) {
		for (var i=0; i<num_frames; ++i) {
			trail = sim_step(agents, trail, width, height);
		}
	}
}

var skip = function() {} // changed elsewhere
