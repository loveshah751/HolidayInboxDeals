import { Card, CardContent, Stack, Typography, Chip } from "@mui/material";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";

interface WishListWallProps {
  offerCount: number;
  connected: boolean;
}

export function WishListWall({ offerCount, connected }: WishListWallProps) {
  return (
    <Card
      sx={{
        background: "linear-gradient(135deg, #c31432 0%, #240b36 100%)",
        color: "white",
        borderRadius: 4,
        boxShadow: "0 20px 60px rgba(195, 20, 50, 0.3)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        },
      }}
    >
      <CardContent sx={{ position: "relative", zIndex: 1 }}>
        <Stack spacing={2} alignItems="center" py={2}>
          <CardGiftcardIcon sx={{ fontSize: 48, color: "#ffd700" }} />
          <Typography variant="h4" fontWeight={700} textAlign="center">
            🎄 Holiday Wish List Wall 🎄
          </Typography>
          <Typography variant="body1" textAlign="center" sx={{ opacity: 0.9 }}>
            Your personalized collection of holiday deals and promotions
          </Typography>
          <Stack direction="row" spacing={2} mt={2}>
            <Chip
              label={`${offerCount} Offers Found`}
              sx={{
                background: "rgba(255, 255, 255, 0.2)",
                color: "white",
                fontWeight: 600,
                fontSize: "1.1rem",
                padding: "20px 10px",
              }}
            />
            {connected && (
              <Chip
                label="✨ Gmail Connected"
                sx={{
                  background: "rgba(76, 175, 80, 0.8)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  padding: "20px 10px",
                }}
              />
            )}
          </Stack>
          <Typography
            variant="body2"
            textAlign="center"
            sx={{
              mt: 2,
              opacity: 0.8,
              fontStyle: "italic",
            }}
          >
            "May your holidays be merry and your savings be bright!" 🌟
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
