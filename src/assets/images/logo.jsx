import React from 'react';
import logoImage from '../images/FlareXlogo.png'; // Adjust the path based on where your PNG is stored

const Logo = ({ className = '' }) => {
  return (
    <img 
      src={logoImage} 
      alt="FlareX Logo" 
      width="40" 
      height="40" 
      className={className}
    />
  );
};

export default Logo;
