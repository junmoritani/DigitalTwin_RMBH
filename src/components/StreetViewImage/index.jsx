// src/components/StreetViewImage.jsx

import "./style.css";
import React from "react"; // It's good practice to import React

const StreetViewImage = ({
  location,
  size = "600x400",
  heading = 0,
  fov = 90,
  pitch = 0,
}) => {
  // Access the API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <div style={{ color: "red" }}>API Key is missing.</div>;
  }

  // Add a check for the required 'location' prop
  if (!location) {
    return (
      <div style={{ color: "orange" }}>
        Error: The 'location' prop is required.
      </div>
    );
  }

  // Construct the URL for the Google Street View Static API
  const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${location}&heading=${heading}&fov=${fov}&pitch=${pitch}&key=${apiKey}`;

  return (
    <div>
      <img
        src={imageUrl}
        alt={`Google Street View of ${location}`}
        style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
      />
    </div>
  );
};

// The export statement must be at the top level
export default StreetViewImage;
