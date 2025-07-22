import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function MapboxMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [lightPreset, setLightPreset] = useState("day");
  const [styleLoaded, setStyleLoaded] = useState(false);
  // const [hour, setHour] = useState(12);

  useEffect(() => {
    if (!TOKEN) {
      console.error("Mapbox token is missing. Check your .env file.");
      return;
    }

    mapboxgl.accessToken = TOKEN;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-43.93483, -19.92999],
      zoom: 16.2,
      pitch: 40,
      bearing: 0,
      style: "mapbox://styles/mapbox/standard",
      antialias: true,
    });

    mapRef.current.on("style.load", () => {
      // fetch("/data/Zoneamento_wgs84.geojson")
      //   .then((res) => res.json())
      //   .then((geojson) => {
      //     const idToColor = {};
      //     const usedColors = new Set();
      //     const getRandomColor = () => {
      //       let color;
      //       do {
      //         color = `#${Math.floor(Math.random() * 16777215)
      //           .toString(16)
      //           .padStart(6, "0")}`;
      //       } while (usedColors.has(color));
      //       usedColors.add(color);
      //       return color;
      //     };
      //     geojson.features.forEach((feature) => {
      //       const id = feature.properties.ID_ZONEAME;
      //       if (!idToColor[id]) {
      //         idToColor[id] = getRandomColor();
      //       }
      //     });
      //     const fillColorExpression = ["match", ["get", "ID_ZONEAME"]];
      //     Object.entries(idToColor).forEach(([id, color]) => {
      //       fillColorExpression.push(parseInt(id), color);
      //     });
      //     fillColorExpression.push("#cccccc"); // fallback color
      //     mapRef.current.addSource("urban-areas", {
      //       type: "geojson",
      //       data: geojson,
      //     });
      //     mapRef.current.addLayer({
      //       id: "bairros-populares",
      //       type: "fill",
      //       source: "urban-areas",
      //       paint: {
      //         "fill-color": fillColorExpression,
      //         "fill-opacity": 0.3,
      //         "line-color": "#333",
      //         "line-width": 1,
      //       },
      //     });
      //   });
      setStyleLoaded(true);
      // Initialize light settings once the style is loaded using the new setLights
      // const initialLightPos = getSunPosition(hour);
      // mapRef.current.setLights([
      //   // Use setLights (plural)
      //   {
      //     id: "custom-light", // Give your light source an ID
      //     type: "flat", // Specify the light type
      //     properties: {
      //       anchor: "map", // Changed from "viewport" as previously discussed, or use 'map'
      //       position: initialLightPos,
      //       intensity: 0.6,
      //       color: "#ffffff",
      //       // You can also add 'ambient-intensity' and 'ambient-color' for flat light
      //       // 'ambient-intensity': 0.2, // Adjust as needed
      //       // 'ambient-color': '#ffffff', // Adjust as needed
      //     },
      //   },
      // ]);
    });

    return () => mapRef.current?.remove();
  }, []);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;

    mapRef.current.setConfigProperty("basemap", "lightPreset", lightPreset);
  }, [lightPreset, styleLoaded]);

  const mapOverlayStyle = {
    font: "12px/20px 'Helvetica Neue', Arial, Helvetica, sans-serif",
    position: "absolute",
    width: "200px",
    top: "0",
    left: "0",
    padding: "10px",
  };

  const mapOverlayInnerStyle = {
    backgroundColor: "#fff",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
    borderRadius: "3px",
    padding: "10px",
    marginBottom: "10px",
  };

  const fieldsetStyle = {
    display: "flex",
    justifyContent: "space-between",
    border: "none",
  };

  const labelStyle = {
    fontWeight: "bold",
    marginRight: "10px",
  };

  const selectFieldsetStyle = {
    display: "block",
    border: "none",
  };

  const selectLabelStyle = {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
  };

  const selectStyle = {
    width: "100%",
  };

  // function getSunPosition(hour) {
  //   // Let's make these values more extreme for debugging visibility
  //   const azimuthal = (hour / 24) * 360;
  //   // Make polar go from 0 (night) to 90 (midday)
  //   const polar = ((hour <= 12 ? hour : 24 - hour) / 12) * 90; // This makes it go 0 -> 90 -> 0
  //   console.log(
  //     `Hour: ${hour}, Azimuthal: ${azimuthal.toFixed(
  //       2
  //     )}, Polar: ${polar.toFixed(2)}`
  //   );
  //   return [azimuthal, polar, 1.5];
  // }

  // useEffect(() => {
  //   console.log(
  //     "Light update useEffect triggered. styleLoaded:",
  //     styleLoaded,
  //     "hour:",
  //     hour
  //   );
  //   if (!styleLoaded || !mapRef.current) {
  //     console.log("Light update skipped: style not loaded or map not ready.");
  //     return;
  //   }

  //   const lightPos = getSunPosition(hour); // getSunPosition will log
  //   console.log("Updating light with position:", lightPos);

  //   mapRef.current.setLights([
  //     {
  //       id: "custom-light",
  //       type: "flat",
  //       properties: {
  //         anchor: "map",
  //         position: lightPos,
  //         intensity: 1.0, // Increase intensity for debugging
  //         color: "#ffffff",
  //       },
  //     },
  //   ]);
  // }, [hour, styleLoaded]); // Dependencies are correct

  return (
    <>
      <div ref={mapContainerRef} id="map" className="map-container" />
      <div className="map-overlay" style={mapOverlayStyle}>
        <div className="map-overlay-inner" style={mapOverlayInnerStyle}>
          <fieldset className="select-fieldset" style={selectFieldsetStyle}>
            <label style={selectLabelStyle}>
              Select light preset
              <select
                id="lightPreset"
                name="lightPreset"
                value={lightPreset}
                onChange={(e) => setLightPreset(e.target.value)}
                style={selectStyle}
              >
                <option value="dawn">Dawn</option>
                <option value="day">Day</option>
                <option value="dusk">Dusk</option>
                <option value="night">Night</option>
              </select>
            </label>
          </fieldset>
          {/* <fieldset className="hour-fieldset" style={fieldsetStyle}>
            <label style={labelStyle}>Hour: {hour}</label>
            <input
              type="range"
              min="0"
              max="23"
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
            />
          </fieldset> */}
        </div>
      </div>
    </>
  );
}

export default MapboxMap;
