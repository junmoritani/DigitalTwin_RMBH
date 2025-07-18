import "./style.css";
import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

function CesiumMap() {
  const cesiumContainer = useRef(null);

  useEffect(() => {
    // Defina seu token do Cesium Ion
    Cesium.Ion.defaultAccessToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3NzUyOTVkZC1lNjU5LTRlY2UtYWRmMi1jYjc5NzUwYTllNzAiLCJpZCI6MjczMTI5LCJpYXQiOjE3Mzg2MDUwMzV9.LT3jluHgUzEJKnbecYYd7dphRD5-_idwfspHSG4ShEA";

    const viewer = new Cesium.Viewer(cesiumContainer.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-43.9378, -19.9208, 1000),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-15.0),
      },
    });

    Cesium.createOsmBuildingsAsync().then((tileset) => {
      viewer.scene.primitives.add(tileset);
    });

    // Cleanup
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  return (
    <div
      id="cesiumContainer"
      ref={cesiumContainer}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}

export default CesiumMap;
