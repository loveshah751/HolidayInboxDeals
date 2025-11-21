import { Box } from "@mui/material";
import { useEffect, useState } from "react";

interface Snowflake {
  id: number;
  left: number;
  animationDuration: number;
  opacity: number;
  fontSize: number;
}

export function ChristmasBackground() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const flakes: Snowflake[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      animationDuration: 5 + Math.random() * 10,
      opacity: 0.3 + Math.random() * 0.7,
      fontSize: 10 + Math.random() * 20,
    }));
    setSnowflakes(flakes);
  }, []);

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to bottom, #0f2027, #203a43, #2c5364)",
          zIndex: -2,
        }}
      />

      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {snowflakes.map((flake) => (
          <Box
            key={flake.id}
            sx={{
              position: "absolute",
              top: -50,
              left: `${flake.left}%`,
              color: "white",
              fontSize: `${flake.fontSize}px`,
              opacity: flake.opacity,
              animation: `snowfall ${flake.animationDuration}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          >
            ❄
          </Box>
        ))}
      </Box>

    </>
  );
}
