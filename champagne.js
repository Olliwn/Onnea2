class ChampagneSimulation {
    constructor() {
        this.canvas = document.getElementById('simulation');
        this.ctx = this.canvas.getContext('2d');
        this.graphCanvas = document.getElementById('pressure-graph');
        this.graphCtx = this.graphCanvas.getContext('2d');
        
        this.initialPressure = 6;
        this.currentPressure = this.initialPressure;
        this.temperature = 12;
        this.isOpen = false;
        this.shakeLevel = 0;
        this.particles = [];
        this.bottleHeight = 400;
        this.bottleWidth = 160;
        this.neckWidth = 40;
        this.neckHeight = 120;
        
        // Cork physics
        this.corkReleasePressure = 7; // Default release pressure
        this.corkMaxPressure = 10; // Pressure at which cork pops immediately
        this.cork = {
            x: 0,
            y: 0,
            rotation: 0,
            height: 30,
            width: this.neckWidth * 0.8, // Cork slightly wider than neck for friction
            isLoose: false,
            velocity: 0,
            friction: 0.98, // High friction while in neck
            initialPosition: 0, // Will be set in resize()
            maxTravelInNeck: 25, // How far cork can move before popping
            escapeVelocity: 30 // Velocity when cork pops
        };
        
        // Liquid properties
        this.liquidLevel = 0.8;
        this.liquidLossRate = 0.02;
        this.liquidColor = 'rgba(255, 223, 118, 0.8)';
        this.minPressureForFlow = 1.2;
        
        // Pressure history for graph
        this.pressureHistory = new Array(300).fill(this.initialPressure);
        this.lastUpdateTime = Date.now();
        
        this.resize();
        this.setupEventListeners();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bottleX = this.canvas.width / 2 - this.bottleWidth / 2;
        this.bottleY = this.canvas.height - this.bottleHeight - 50;
        
        // Reset cork position
        this.cork.initialPosition = this.bottleY - this.cork.height;
        this.cork.x = this.bottleX + this.bottleWidth/2 - this.cork.width/2;
        this.cork.y = this.cork.initialPosition;
        
        // Set graph canvas size
        this.graphCanvas.width = this.graphCanvas.offsetWidth;
        this.graphCanvas.height = this.graphCanvas.offsetHeight;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());
        
        document.getElementById('pressure').addEventListener('input', (e) => {
            this.initialPressure = parseFloat(e.target.value);
            if (!this.isOpen) {
                this.currentPressure = this.initialPressure;
                this.updatePressureDisplay();
            }
        });

        document.getElementById('temperature').addEventListener('input', (e) => {
            this.temperature = parseFloat(e.target.value);
        });

        document.getElementById('corkPressure').addEventListener('input', (e) => {
            this.corkReleasePressure = parseFloat(e.target.value);
        });

        document.getElementById('shake').addEventListener('click', () => {
            if (!this.isOpen) {
                this.shakeLevel = Math.min(this.shakeLevel + 2, 10);
                this.currentPressure = Math.min(this.currentPressure + 1, 10);
                this.updatePressureDisplay();
            }
        });

        document.getElementById('open').addEventListener('click', () => {
            if (!this.isOpen) {
                this.cork.isLoose = true;
            }
        });
    }

    updatePressureDisplay() {
        document.getElementById('current-pressure').textContent = 
            this.currentPressure.toFixed(1);
    }

    openBottle() {
        this.isOpen = true;
        this.createBubbles();
    }

    createBubbles() {
        if (!this.isOpen || this.currentPressure <= this.minPressureForFlow || this.liquidLevel <= 0) return;
        
        const bubbleCount = Math.floor((this.currentPressure + this.shakeLevel + this.temperature / 5) * 20);
        const neckCenterX = this.bottleX + this.bottleWidth/2;
        
        for (let i = 0; i < bubbleCount; i++) {
            this.particles.push({
                x: neckCenterX + (Math.random() - 0.5) * this.neckWidth * 0.5,
                y: this.bottleY,
                vx: (Math.random() - 0.5) * (this.currentPressure / 2),
                vy: -Math.random() * (this.currentPressure + this.shakeLevel) * 2,
                radius: Math.random() * 3 + 1,
                life: 1,
                isCork: false
            });
        }
    }

    updateCork(dt) {
        if (this.isOpen || !this.cork.isLoose) return;

        const pressureForce = this.currentPressure - this.corkReleasePressure;
        if (pressureForce > 0) {
            // Calculate distance moved from initial position
            const distanceMoved = this.cork.initialPosition - this.cork.y;
            
            // Increase friction as cork moves up the neck
            const positionBasedFriction = this.cork.friction * (1 + distanceMoved / 50);
            
            // Calculate acceleration based on pressure and position
            let acceleration = pressureForce * 0.5; // Reduced initial acceleration
            
            // If cork is near the end of its travel in the neck
            if (distanceMoved >= this.cork.maxTravelInNeck) {
                this.popCork();
                return;
            }
            
            // Update cork velocity with position-based friction
            this.cork.velocity = (this.cork.velocity + acceleration * dt) * positionBasedFriction;
            
            // Update cork position
            this.cork.y -= this.cork.velocity;
            
            // Add slight rotation based on movement
            this.cork.rotation = (distanceMoved / this.cork.maxTravelInNeck) * 0.2;
            
            // Check if pressure is too high for controlled movement
            if (this.currentPressure >= this.corkMaxPressure) {
                this.popCork();
            }
        } else {
            // Reset cork velocity if pressure is too low
            this.cork.velocity = 0;
        }
    }

    popCork() {
        this.isOpen = true;
        // Add cork as a particle with high velocity
        const baseVelocity = this.cork.escapeVelocity;
        const pressureBonus = (this.currentPressure - this.corkReleasePressure) * 2;
        const popVelocity = baseVelocity + pressureBonus;
        
        this.particles.push({
            x: this.cork.x + this.cork.width/2,
            y: this.cork.y + this.cork.height/2,
            vx: (Math.random() - 0.5) * 5,
            vy: -popVelocity,
            radius: this.cork.width/2,
            life: 3,
            isCork: true,
            rotation: this.cork.rotation
        });
        
        // Add some small particles for the "pop" effect
        for (let i = 0; i < 20; i++) {
            const angle = (Math.random() * Math.PI) / 2 - Math.PI/4; // Spread in an upward arc
            const speed = popVelocity * (0.3 + Math.random() * 0.3); // 30-60% of cork speed
            this.particles.push({
                x: this.cork.x + this.cork.width/2,
                y: this.cork.y + this.cork.height/2,
                vx: Math.sin(angle) * speed,
                vy: -Math.cos(angle) * speed,
                radius: 1 + Math.random() * 2,
                life: 0.5 + Math.random() * 0.5,
                isCork: false
            });
        }
    }

    drawBottle() {
        const ctx = this.ctx;
        const bodyStartY = this.bottleY + this.neckHeight;
        
        // Create clipping path for the bottle shape
        ctx.save();
        ctx.beginPath();
        
        // Define bottle shape for clipping
        // Left side of bottle
        ctx.moveTo(this.bottleX, bodyStartY + this.bottleHeight - this.neckHeight);
        ctx.bezierCurveTo(
            this.bottleX - 20, bodyStartY + (this.bottleHeight - this.neckHeight) * 0.7,
            this.bottleX - 20, bodyStartY,
            this.bottleX + (this.bottleWidth - this.neckWidth) / 2, bodyStartY
        );
        
        // Neck (left side)
        ctx.lineTo(this.bottleX + (this.bottleWidth - this.neckWidth) / 2, this.bottleY);
        
        // Top of neck
        ctx.lineTo(this.bottleX + (this.bottleWidth + this.neckWidth) / 2, this.bottleY);
        
        // Neck (right side)
        ctx.lineTo(this.bottleX + (this.bottleWidth + this.neckWidth) / 2, bodyStartY);
        
        // Right side of bottle
        ctx.bezierCurveTo(
            this.bottleX + this.bottleWidth + 20, bodyStartY,
            this.bottleX + this.bottleWidth + 20, bodyStartY + (this.bottleHeight - this.neckHeight) * 0.7,
            this.bottleX + this.bottleWidth, bodyStartY + this.bottleHeight - this.neckHeight
        );
        
        ctx.closePath();
        ctx.clip();

        // Draw bottle body
        ctx.fillStyle = 'rgba(58, 90, 64, 0.7)';
        ctx.fill();
        
        // Draw liquid within clipping path
        if (this.liquidLevel > 0) {
            ctx.fillStyle = this.liquidColor;
            
            const totalBottleVolume = (this.bottleHeight - this.neckHeight) * this.bottleWidth + 
                                    this.neckHeight * this.neckWidth;
            const currentVolume = totalBottleVolume * this.liquidLevel;
            
            // Calculate liquid height in the body and neck
            let liquidInBody = currentVolume;
            let liquidHeightInNeck = 0;
            
            if (currentVolume > (this.bottleHeight - this.neckHeight) * this.bottleWidth) {
                liquidInBody = (this.bottleHeight - this.neckHeight) * this.bottleWidth;
                const remainingVolume = currentVolume - liquidInBody;
                liquidHeightInNeck = remainingVolume / this.neckWidth;
            }
            
            const liquidHeightInBody = liquidInBody / this.bottleWidth;
            const liquidStartY = bodyStartY + (this.bottleHeight - this.neckHeight) - liquidHeightInBody;
            
            ctx.beginPath();
            
            // Draw liquid in the body
            if (liquidHeightInBody > 0) {
                ctx.fillRect(
                    this.bottleX - 20,
                    liquidStartY,
                    this.bottleWidth + 40,
                    liquidHeightInBody
                );
            }
            
            // Draw liquid in the neck if it reaches that high
            if (liquidHeightInNeck > 0) {
                ctx.fillRect(
                    this.bottleX + (this.bottleWidth - this.neckWidth) / 2,
                    bodyStartY - liquidHeightInNeck,
                    this.neckWidth,
                    liquidHeightInNeck
                );
            }
            
            // Draw bubbles inside the liquid
            if (this.currentPressure > 1) {
                const maxBubbleY = liquidStartY + liquidHeightInBody;
                for (let i = 0; i < this.currentPressure * 3; i++) {
                    let bubbleX, bubbleY;
                    
                    if (liquidHeightInNeck > 0 && Math.random() < 0.3) {
                        // Bubbles in neck
                        bubbleX = this.bottleX + (this.bottleWidth - this.neckWidth) / 2 + 
                                 Math.random() * this.neckWidth;
                        bubbleY = bodyStartY - Math.random() * liquidHeightInNeck;
                    } else {
                        // Bubbles in body
                        bubbleX = this.bottleX + Math.random() * this.bottleWidth;
                        bubbleY = liquidStartY + Math.random() * liquidHeightInBody;
                    }
                    
                    const radius = Math.random() * 2 + 1;
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        
        ctx.restore();

        // Draw cork (outside of clipping path)
        if (!this.isOpen) {
            ctx.save();
            ctx.fillStyle = '#8b4513';
            ctx.translate(this.cork.x + this.cork.width/2, this.cork.y + this.cork.height/2);
            ctx.rotate(this.cork.rotation);
            ctx.fillRect(
                -this.cork.width/2,
                -this.cork.height/2,
                this.cork.width,
                this.cork.height
            );
            ctx.restore();
        }
    }

    updateParticles() {
        const now = Date.now();
        const dt = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

        // Update cork physics
        if (this.currentPressure >= this.corkReleasePressure && !this.isOpen) {
            this.cork.isLoose = true;
            this.updateCork(dt);
        }

        // Update pressure
        if (this.isOpen) {
            const decayRate = 0.5 * (1 + this.temperature / 25);
            this.currentPressure = Math.max(
                1,
                this.currentPressure - (this.currentPressure - 1) * decayRate * dt
            );
            
            if (this.liquidLevel > 0 && this.currentPressure > this.minPressureForFlow) {
                const pressureDifferential = this.currentPressure - this.minPressureForFlow;
                this.liquidLevel = Math.max(
                    0,
                    this.liquidLevel - this.liquidLossRate * dt * pressureDifferential
                );
            }
            
            this.updatePressureDisplay();
        }

        // Update pressure history
        this.pressureHistory.push(this.currentPressure);
        this.pressureHistory.shift();

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.2; // gravity
            if (particle.isCork) {
                particle.rotation += particle.vx * 0.1;
            }
            particle.life -= 0.01;

            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.isOpen && this.currentPressure > this.minPressureForFlow && 
            this.liquidLevel > 0 && Math.random() < 0.3) {
            this.createBubbles();
        }

        if (this.shakeLevel > 0) {
            this.shakeLevel = Math.max(0, this.shakeLevel - dt);
        }
    }

    drawParticles() {
        for (const particle of this.particles) {
            this.ctx.save();
            if (particle.isCork) {
                // Draw cork particle
                this.ctx.fillStyle = '#8b4513';
                this.ctx.translate(particle.x, particle.y);
                this.ctx.rotate(particle.rotation);
                this.ctx.fillRect(
                    -this.cork.width/2,
                    -this.cork.height/2,
                    this.cork.width,
                    this.cork.height
                );
            } else {
                // Draw champagne particle
                this.ctx.fillStyle = this.liquidColor;
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }
    }

    drawPressureGraph() {
        const ctx = this.graphCtx;
        const width = this.graphCanvas.width;
        const height = this.graphCanvas.height;
        
        // Clear graph
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.clearRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = height * (1 - i / 4);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw pressure line
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height * (1 - (this.pressureHistory[0] - 1) / 9));
        
        for (let i = 1; i < this.pressureHistory.length; i++) {
            const x = (i / (this.pressureHistory.length - 1)) * width;
            const y = height * (1 - (this.pressureHistory[i] - 1) / 9);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBottle();
        this.updateParticles();
        this.drawParticles();
        this.drawPressureGraph();

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the simulation when the page loads
window.addEventListener('load', () => {
    new ChampagneSimulation();
}); 