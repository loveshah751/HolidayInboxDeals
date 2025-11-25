import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  IconButton,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
} from "@mui/material";
import CoffeeIcon from "@mui/icons-material/Coffee";
import LogoutIcon from "@mui/icons-material/Logout";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import BoltIcon from "@mui/icons-material/Bolt";
import { fetchConnectUrl, fetchSession } from "./api";
import { useOffers } from "./hooks/useOffers";
import { nhost } from "./nhost";
import "./styles.css";
import { ChristmasBackground } from "./ChristmasBackground";
import { WishListWall } from "./WishListWall";

const AUTO_CONNECT_STORAGE_KEY = "gmailAutoConnectUser";
const SPECIAL_USER_EMAIL = import.meta.env.VITE_SPECIAL_USER_EMAIL?.toLowerCase();
const SPECIAL_USER_NAME = import.meta.env.VITE_SPECIAL_USER_NAME?.toLowerCase();

const BRAND_LOGOS: Record<string, string> = {
  amazon: "https://logo.clearbit.com/amazon.com",
  nike: "https://logo.clearbit.com/nike.com",
  walmart: "https://logo.clearbit.com/walmart.com",
  target: "https://logo.clearbit.com/target.com",
  "best buy": "https://logo.clearbit.com/bestbuy.com",
  macys: "https://logo.clearbit.com/macys.com",
  sephora: "https://logo.clearbit.com/sephora.com",
  ulta: "https://logo.clearbit.com/ulta.com",
  costco: "https://logo.clearbit.com/costco.com",
  ebay: "https://logo.clearbit.com/ebay.com",
  starbucks: "https://logo.clearbit.com/starbucks.com",
  "bath & body works": "https://logo.clearbit.com/bathandbodyworks.com",
  shein: "https://logo.clearbit.com/us.shein.com",
};

const getBrandLogo = (brand?: string): string | undefined => {
  if (!brand) return undefined;
  const key = brand.trim().toLowerCase();
  return BRAND_LOGOS[key];
};

const theme = createTheme({
  palette: {
    primary: {
      main: "#2563eb",
    },
    secondary: {
      main: "#f97316",
    },
    background: {
      default: "#f8fafc",
    },
  },
  shape: {
    borderRadius: 16,
  },
});

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSession = nhost.getUserSession();
  const processedRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [userEmail, setUserEmail] = useState<string | null>(initialSession?.user?.email ?? null);
  const [userProfile, setUserProfile] = useState(initialSession?.user ?? null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [connected, setConnected] = useState(false);
  const [gmailAddress, setGmailAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(initialSession ? "success" : "idle");

  const handleInvalidToken = useCallback(() => {
    setNeedsReconnect(true);
    setConnected(false);
  }, []);

  const { offers, loading: offersLoading, error: offersError, nextPageToken, refresh } = useOffers(connected, handleInvalidToken);

  const loadSession = useCallback(async () => {
    const tryFetchSession = async () => {
      const session = await fetchSession();
      setConnected(session.connected);
      setGmailAddress(session.gmail_address ?? null);
      setNeedsReconnect(!session.connected);
    };

    const ensureToken = async () => {
      if (nhost.getUserSession()?.accessToken) {
        return true;
      }
      try {
        const refreshed = await nhost.refreshSession();
        if (!refreshed?.accessToken) {
          setConnected(false);
          setGmailAddress(null);
          setSessionError(null);
          setNeedsReconnect(false);
          setSessionChecked(true);
          return false;
        }
        return true;
      } catch {
        setConnected(false);
        setGmailAddress(null);
        setSessionError(null);
        setNeedsReconnect(false);
        setSessionChecked(true);
        return false;
      }
    };

    if (!(await ensureToken())) {
      return;
    }

    setSessionLoading(true);
    setSessionError(null);
    try {
      await tryFetchSession();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to check Gmail status";
      const lower = message.toLowerCase();
      if (
        lower.includes("missing authorization header") ||
        lower.includes("request failed: 401") ||
        lower.includes("invalid token")
      ) {
        try {
          const refreshed = await nhost.refreshSession();
          if (refreshed?.accessToken) {
            await tryFetchSession();
            return;
          }
        } catch {
          // fall through to reset state below
        }
        setSessionError(null);
      } else {
        setSessionError(message);
      }
      setConnected(false);
      setGmailAddress(null);
      setNeedsReconnect(true);
    } finally {
      setSessionLoading(false);
      setSessionChecked(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refreshToken = params.get("refreshToken");
    if (!refreshToken || processedRef.current) {
      return;
    }
    processedRef.current = true;
    let isMounted = true;

    const removeRefreshTokenFromUrl = () => {
      if (typeof window === "undefined") {
        return;
      }
      const url = new URL(window.location.href);
      if (url.searchParams.has("refreshToken")) {
        url.searchParams.delete("refreshToken");
        window.history.replaceState({}, document.title, url.toString());
      }
    };

    const processToken = async () => {
      try {
        setStatus("verifying");
        setAuthLoading(true);
        setAuthError(null);
        const response = await nhost.auth.refreshToken({ refreshToken });
        if (!isMounted) {
          return;
        }
        if (response.status !== 200) {
          throw new Error("Failed to verify sign-in with Google");
        }
        const userData = response.body?.user;
        setUserProfile(userData);
        setUserEmail(userData?.email ?? null);
        setStatus("success");
        await loadSession();
        navigate("/", { replace: true });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        const message = err instanceof Error ? err.message : "An error occurred during verification";
        setAuthError(message);
        processedRef.current = false;
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
        removeRefreshTokenFromUrl();
      }
    };

    void processToken();

    return () => {
      isMounted = false;
    };
  }, [location.search, navigate, loadSession]);

  useEffect(() => {
    const unsubscribe = nhost.sessionStorage.onChange((session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserProfile(session?.user ?? null);
      setStatus(session ? "success" : "idle");
      if (session) {
        void loadSession();
      } else {
        setConnected(false);
        setGmailAddress(null);
        autoConnectAttempted.current = false;
        setNeedsReconnect(false);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(AUTO_CONNECT_STORAGE_KEY);
        }
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [loadSession]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleSignIn = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setStatus("idle");
    try {
      const redirectTo = import.meta.env.VITE_NHOST_REDIRECT_TO;
      const url = nhost.auth.signInProviderURL("google", redirectTo ? { redirectTo } : undefined);
      if (!url) {
        throw new Error("Failed to generate sign-in URL");
      }
      window.location.assign(url);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed");
      setAuthLoading(false);
    }
  }, []);

  const handleSignOut = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const session = nhost.getUserSession();
      await nhost.auth.signOut(session?.refreshToken ? { refreshToken: session.refreshToken } : {});
      nhost.clearSession();
      setConnected(false);
      setGmailAddress(null);
      setUserEmail(null);
      setUserProfile(null);
      setStatus("idle");
      autoConnectAttempted.current = false;
      setSessionChecked(false);
      setNeedsReconnect(false);
      setSessionError(null);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(AUTO_CONNECT_STORAGE_KEY);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-out failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConnectGmail = useCallback(
    async (auto = false) => {
      if (!nhost.getUserSession()?.accessToken) {
        await handleSignIn();
        return;
      }
      if (!auto) {
        autoConnectAttempted.current = true;
      }
      setConnectError(null);
      setConnectLoading(true);
      try {
        const currentUserId = nhost.getUserSession()?.user?.id ?? userProfile?.id ?? userEmail ?? null;
        if (auto && currentUserId && typeof window !== "undefined") {
          window.sessionStorage.setItem(AUTO_CONNECT_STORAGE_KEY, currentUserId);
        }
        const { auth_url } = await fetchConnectUrl();
        window.location.assign(auth_url);
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : "Failed to start Gmail consent");
        setConnectLoading(false);
        if (auto) {
          autoConnectAttempted.current = false;
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(AUTO_CONNECT_STORAGE_KEY);
          }
        }
      }
    },
    [userProfile, userEmail, handleSignIn],
  );

  useEffect(() => {
    if (!sessionChecked || !userEmail) {
      autoConnectAttempted.current = false;
      return;
    }
    if (connected || sessionLoading || connectLoading) {
      return;
    }
    const pendingUserId =
      typeof window !== "undefined" ? window.sessionStorage.getItem(AUTO_CONNECT_STORAGE_KEY) : null;
    const currentUserId = nhost.getUserSession()?.user?.id ?? userProfile?.id ?? userEmail ?? null;
    if (autoConnectAttempted.current || pendingUserId === currentUserId) {
      return;
    }
    autoConnectAttempted.current = true;
    void handleConnectGmail(true);
  }, [userEmail, connected, sessionLoading, connectLoading, handleConnectGmail, userProfile, sessionChecked]);

  useEffect(() => {
    if (connected) {
      autoConnectAttempted.current = false;
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(AUTO_CONNECT_STORAGE_KEY);
      }
      setNeedsReconnect(false);
    }
  }, [connected]);

  const showOffers = connected && Boolean(userEmail);

  const statusText = useMemo(() => {
    if (!userEmail) {
      return null;
    }
    if (sessionLoading) {
      return "Checking Gmail connection…";
    }
    if (connected) {
      return undefined;
    }
    const displayName = userProfile?.displayName || userEmail;
    return `Signed in as ${displayName}. Connect Gmail to unlock offers.`;
  }, [status, userEmail, sessionLoading, connected, gmailAddress, userProfile]);

  const stepIndex = useMemo(() => {
    if (!userEmail) return 0;
    if (!connected) return 1;
    return 2;
  }, [userEmail, connected]);

  return (
    <ThemeProvider theme={theme}>
      <ChristmasBackground />
      <CssBaseline />
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#0f172a" }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" py={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <MailOutlineIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Holiday Inbox Deals
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<CoffeeIcon />}
              href="https://www.buymeacoffee.com/PunjabiNerd"
              target="_blank"
              rel="noreferrer"
              sx={{ textTransform: "none", ml: 2 }}
            >
              Fuel the PunjabiNerd grind ☕🚀
            </Button>
          </Stack>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box
            sx={{
              p: 4,
              borderRadius: 4,
              background: "linear-gradient(135deg, #dbeafe, #ede9fe)",
              boxShadow: "0 15px 35px rgba(37,99,235,0.1)",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="center">
              <Stack flex={1} spacing={1}>
                <Typography variant="h4" fontWeight={700}>
                  Promotions, distilled.
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Connect Gmail and we’ll surface the best promo codes, flash sales, and expiring discounts—no inbox digging required.
                </Typography>
                <Stepper activeStep={stepIndex} alternativeLabel sx={{ mt: 2 }}>
                  {["Sign in", "Connect Gmail", "Browse offers"].map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Stack>
              <Card sx={{ minWidth: 320, borderRadius: 3 }}>
                <CardContent>
                  <Stack spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
                      {userProfile?.displayName?.[0]?.toUpperCase() ?? userEmail?.[0]?.toUpperCase() ?? "?"}
                    </Avatar>
                    <Stack spacing={0.5} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={600}>
                        {(() => {
                          const displayName = userProfile?.displayName ?? userEmail ?? "Not signed in";
                          const matchesSpecial =
                            SPECIAL_USER_NAME && displayName && displayName.toLowerCase() === SPECIAL_USER_NAME;
                          const matchesEmail =
                            userEmail && SPECIAL_USER_EMAIL && userEmail.toLowerCase() === SPECIAL_USER_EMAIL;
                          if ((matchesSpecial || matchesEmail) && displayName !== "Not signed in") {
                            return `❤️ ${displayName} ❤️`;
                          }
                          return displayName;
                        })()}
                      </Typography>
                      {(() => {
                        const displayName = userProfile?.displayName ?? userEmail ?? "";
                        const matchesSpecial =
                          SPECIAL_USER_NAME && displayName && displayName.toLowerCase() === SPECIAL_USER_NAME;
                        const matchesEmail =
                          userEmail && SPECIAL_USER_EMAIL && userEmail.toLowerCase() === SPECIAL_USER_EMAIL;
                        if (matchesSpecial || matchesEmail) {
                          return (
                            <Typography variant="body2" color="secondary">
                              Hello my beautiful, I love you baby ❤️
                            </Typography>
                          );
                        }
                        return null;
                      })()}
                      {statusText && (
                        <Typography variant="body2" color="text.secondary">
                          {statusText}
                        </Typography>
                      )}
                    </Stack>
                    {sessionLoading && <LinearProgress sx={{ width: "100%", borderRadius: 2 }} />}
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                  {!connected ? (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleConnectGmail()}
                      disabled={connectLoading || sessionLoading}
                      startIcon={<BoltIcon />}
                      sx={{ textTransform: "none", px: 3 }}
                    >
                      {connectLoading ? "Opening Google…" : "Connect Gmail"}
                    </Button>
                  ) : (
                    <Chip label="Gmail connected" color="success" />
                  )}
                  {userEmail && (
                    <Tooltip title="Sign out">
                      <span>
                        <IconButton onClick={handleSignOut} color="primary">
                          <LogoutIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </CardActions>
              </Card>
            </Stack>
          </Box>

        {(authError || connectError || (sessionError && !needsReconnect)) && (
          <Card variant="outlined" sx={{ borderColor: "#fecaca", backgroundColor: "#fef2f2" }}>
            <CardContent>
              {[authError, connectError, !needsReconnect ? sessionError : null].map(
                (err, idx) =>
                  err && (
                    <Typography key={idx} color="error" variant="body2">
                      {err}
                    </Typography>
                  ),
              )}
            </CardContent>
          </Card>
        )}

        {showOffers && <WishListWall offerCount={offers.length} connected={connected} />}

        {showOffers ? (
          <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight={600}>
                  Latest promotions
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => refresh(null)}
                    disabled={offersLoading}
                    sx={{ textTransform: "none" }}
                  >
                    {offersLoading ? "Refreshing…" : "Refresh"}
                  </Button>
                  {nextPageToken && (
                    <Button
                      variant="contained"
                      onClick={() => refresh(nextPageToken)}
                      disabled={offersLoading}
                      sx={{ textTransform: "none" }}
                    >
                      Next page
                    </Button>
                  )}
                </Stack>
              </Stack>
              {offersError && (
                <Typography color="error" variant="body2">
                  {offersError}
                </Typography>
              )}
              {offersLoading && (
                <Stack direction="row" spacing={2} alignItems="center">
                  <CircularProgress size={32} />
                  <Typography>Loading offers…</Typography>
                </Stack>
              )}
              {!offersLoading && offers.length === 0 && (
                <Box
                  sx={{
                    p: 4,
                    textAlign: "center",
                    borderRadius: 3,
                    border: "1px dashed #cbd5f5",
                    backgroundColor: "white",
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    No promotions found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Check back later or refresh to see if new offers land in your inbox.
                  </Typography>
                </Box>
              )}
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                {offers.map((offer, index) => {
                  const brandLogo = getBrandLogo(offer.brand);
                  return (
                    <Card key={`${offer.brand}-${offer.description}-${index}`} sx={{ display: "flex", flexDirection: "column" }}>
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                          <Avatar
                            src={brandLogo}
                            alt={offer.brand}
                            sx={{
                              bgcolor: brandLogo ? "transparent" : "#e0e7ff",
                              color: "#4338ca",
                              border: brandLogo ? "1px solid #e2e8f0" : "none",
                            }}
                          >
                            {offer.brand?.[0]?.toUpperCase() ?? "?"}
                          </Avatar>
                          <div>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {offer.brand}
                            </Typography>
                            {offer.discount && (
                              <Chip size="small" label={offer.discount} color="secondary" sx={{ fontWeight: 600, mt: 0.5 }} />
                            )}
                          </div>
                        </Stack>
                        <Typography variant="body1" gutterBottom fontWeight={500}>
                          {offer.description}
                        </Typography>
                      <Stack spacing={0.5} mt={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={offer.code ? `Code: ${offer.code}` : "Code not required"} />
                          {offer.expiry && (
                            <Chip
                              size="small"
                              color="default"
                              label={`Expires: ${new Date(offer.expiry).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}`}
                            />
                          )}
                        </Stack>
                      </Stack>
                      </CardContent>
                      {offer.link && (
                        <CardActions sx={{ px: 3, pb: 3 }}>
                          <Button
                            href={offer.link}
                            target="_blank"
                            rel="noreferrer"
                            variant="contained"
                            fullWidth
                            sx={{ textTransform: "none" }}
                          >
                            View email
                          </Button>
                        </CardActions>
                      )}
                    </Card>
                  );
                })}
              </Box>
            </Stack>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: "#fee2e2", color: "#b91c1c" }}>
                    <MailOutlineIcon />
                  </Avatar>
                  <Stack>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Connect Gmail to unlock offers
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      We request read-only access to your Promotions label so we can surface discount codes and limited-time offers.
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}
          {needsReconnect && userEmail && !sessionLoading && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Gmail access expired
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Your Gmail session is no longer valid. Please reconnect to keep fetching offers.
                    </Typography>
                  </Stack>
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleConnectGmail()}
                      disabled={connectLoading}
                      startIcon={<BoltIcon />}
                      sx={{ textTransform: "none" }}
                    >
                      {connectLoading ? "Opening…" : "Reconnect Gmail"}
                    </Button>
                  </span>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
