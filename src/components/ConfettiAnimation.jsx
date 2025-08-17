import React, { useEffect, useRef } from 'react';

const ConfettiAnimation = ({ isActive, onComplete }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const confettiRef = useRef([]);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Confetti particle class
    class ConfettiParticle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = -10;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = Math.random() * 3 + 2;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 10;
        this.size = Math.random() * 10 + 5;
        this.color = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ][Math.floor(Math.random() * 10)];
        this.shape = Math.random() > 0.5 ? 'square' : 'circle';
        this.opacity = 1;
        this.fadeSpeed = Math.random() * 0.02 + 0.005;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.vy += 0.1; // gravity
        this.opacity -= this.fadeSpeed;
        
        // Add some wind effect
        this.vx += (Math.random() - 0.5) * 0.5;
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        
        ctx.fillStyle = this.color;
        
        if (this.shape === 'square') {
          ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }

      isDead() {
        return this.opacity <= 0 || this.y > canvas.height + 50;
      }
    }

    // Create initial confetti
    const createConfetti = () => {
      for (let i = 0; i < 150; i++) {
        confettiRef.current.push(new ConfettiParticle());
      }
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw confetti
      confettiRef.current = confettiRef.current.filter(particle => {
        particle.update();
        particle.draw();
        return !particle.isDead();
      });
      
      // Add more confetti for the first 2 seconds
      if (confettiRef.current.length < 50 && Date.now() - startTime < 2000) {
        for (let i = 0; i < 5; i++) {
          confettiRef.current.push(new ConfettiParticle());
        }
      }
      
      // Continue animation if there are still particles
      if (confettiRef.current.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        if (onComplete) {
          onComplete();
        }
      }
    };

    const startTime = Date.now();
    createConfetti();
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
};

export default ConfettiAnimation;
