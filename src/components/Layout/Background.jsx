import React, { useEffect, useState } from 'react';
import '../../styles/BackgroundEffect.css';

const Background = () => {
  const [stars, setStars] = useState([]);

  useEffect(() => {
    // Generate random stars
    const generateStars = () => {
      const newStars = [];
      const starCount = 200; // Number of stars to generate

      for (let i = 0; i < starCount; i++) {
        const size = Math.random();
        let sizeClass = 'small';

        if (size > 0.8) {
          sizeClass = 'large';
        } else if (size > 0.5) {
          sizeClass = 'medium';
        }

        // Randomly make some stars bright blue
        const isBright = Math.random() > 0.9;

        // Randomly make some stars shooting stars
        const isShooting = Math.random() > 0.95;

        // For shooting stars, calculate random movement
        let distanceX = 0;
        let distanceY = 0;
        let shootingDuration = '';

        if (isShooting) {
          // Random direction and distance
          distanceX = `${(Math.random() * 200) - 100}px`;
          distanceY = `${(Math.random() * 200) - 100}px`;
          shootingDuration = `${30 + Math.random() * 70}s`; // Slow movement, 30-100s
        }

        newStars.push({
          id: i,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          size: sizeClass,
          bright: isBright && !isShooting, // Don't make shooting stars also bright
          shooting: isShooting,
          duration: `${3 + Math.random() * 7}s`, // Random duration between 3-10s
          distanceX,
          distanceY,
          shootingDuration
        });
      }

      setStars(newStars);
    };

    generateStars();
  }, []);

  return (
    <div className="FlareXfi-background">
      <div className="grid-pattern"></div>
      <div className="glow-effect"></div>
      <div className="glow-top"></div>
      <div className="glow-bottom"></div>

      {/* Stars */}
      <div className="stars">
        {stars.map(star => (
          <div
            key={star.id}
            className={`star ${star.size} ${star.bright ? 'bright' : ''} ${star.shooting ? 'shooting' : ''}`}
            style={{
              left: star.left,
              top: star.top,
              '--duration': star.duration,
              '--distance-x': star.distanceX,
              '--distance-y': star.distanceY,
              '--shooting-duration': star.shootingDuration
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Background;
