import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, alpha, createTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MenuIcon from '@mui/icons-material/Menu';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import {
  bootstrapAppData,
  clearDatabase,
  clearDashboard,
  createOperator,
  deleteDashboardItem,
  deleteOperator,
  getSupabaseConfigError,
  isSupabaseConfigured,
  listActivityHistory,
  saveProduct,
  signIn,
  signOut,
  subscribeToAuthChanges,
  toggleOperatorActive,
} from './api';

const EMPTY_FORM = {
  name: '',
  plu: '',
  barcode: '',
  photo: '',
  photoPath: '',
  expiration: '',
};

const EMPTY_LOGIN_FORM = {
  email: '',
  password: '',
};

const EMPTY_OPERATOR_FORM = {
  email: '',
  displayName: '',
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#080808',
      paper: '#111112',
    },
    primary: {
      main: '#f97316',
    },
    secondary: {
      main: '#38bdf8',
    },
    error: {
      main: '#ef4444',
    },
    success: {
      main: '#22c55e',
    },
    text: {
      primary: '#f8f4eb',
      secondary: '#cabfae',
    },
  },
  typography: {
    fontFamily: ['DM Sans', 'Segoe UI', 'sans-serif'].join(','),
    h4: { fontFamily: 'Bree Serif, serif', fontWeight: 400 },
    h5: { fontFamily: 'Bree Serif, serif', fontWeight: 400 },
    h6: { fontFamily: 'Bree Serif, serif', fontWeight: 400 },
    body1: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 18,
  },
});

class ScannerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function App() {
  const isMobile = useMediaQuery('(max-width:600px)');
  const crestSrc = `${import.meta.env.BASE_URL}rj-crest.png`;
  const photoInputRef = useRef(null);
  const supabaseConfigError = getSupabaseConfigError();
  const supportsLiveScanner = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [productDB, setProductDB] = useState([]);
  const [operators, setOperators] = useState([]);
  const [session, setSession] = useState(null);
  const [authBooting, setAuthBooting] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN_FORM);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [operatorForm, setOperatorForm] = useState(EMPTY_OPERATOR_FORM);
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [operatorSaving, setOperatorSaving] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [scanSearchOpen, setScanSearchOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  const isDeveloper = session?.role === 'developer';

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 3,
      background: 'rgba(247, 239, 224, 0.03)',
      color: '#f8f4eb',
      '& fieldset': { borderColor: 'rgba(244, 228, 195, 0.18)' },
      '&:hover fieldset': { borderColor: 'rgba(249, 115, 22, 0.6)' },
      '&.Mui-focused fieldset': { borderColor: '#f97316', borderWidth: 2 },
    },
    '& .MuiInputLabel-root': { color: '#cabfae' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f8f4eb' },
    '& input': { color: '#f8f4eb' },
  };

  const actionButtonSx = {
    borderRadius: 999,
    px: 2.2,
    py: 1.1,
    fontWeight: 700,
    letterSpacing: 0.2,
    textTransform: 'none',
  };

  const applyBootstrapData = (data) => {
    setProducts(Array.isArray(data?.dashboard) ? data.dashboard : []);
    setProductDB(Array.isArray(data?.productDB) ? data.productDB : []);
    setOperators(Array.isArray(data?.operators) ? data.operators : []);
  };

  const clearAppData = () => {
    setSession(null);
    setProducts([]);
    setProductDB([]);
    setOperators([]);
    setActivities([]);
  };

  const resetFormState = () => {
    setForm(EMPTY_FORM);
    setEditProduct(null);
    setFormVisible(false);
    setScanDialogOpen(false);
  };

  const loadBootstrap = async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured) {
      clearAppData();
      setAuthBooting(false);
      setSyncing(false);
      return;
    }

    if (!silent) {
      setSyncing(true);
    }

    try {
      const payload = await bootstrapAppData();
      setSession(payload.session);
      applyBootstrapData(payload.data);

      if (!payload.session) {
        setActivities([]);
      }
    } catch (error) {
      clearAppData();

      if (!silent) {
        setSnackbar({
          open: true,
          message: error.message || 'Could not connect to Supabase.',
          severity: 'error',
        });
      }
    } finally {
      setAuthBooting(false);
      if (!silent) {
        setSyncing(false);
      }
    }
  };

  const loadBootstrapEvent = useEffectEvent(async (options) => {
    await loadBootstrap(options);
  });

  const clearAppDataEvent = useEffectEvent(() => {
    clearAppData();
  });

  const loadActivityHistory = async () => {
    if (!isDeveloper) {
      return;
    }

    setActivityLoading(true);
    try {
      const payload = await listActivityHistory();
      setActivities(payload.activities || []);
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not load activity history.', severity: 'error' });
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthBooting(false);
      return undefined;
    }

    void loadBootstrapEvent();

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      if (!nextSession) {
        clearAppDataEvent();
        setAuthBooting(false);
        setSyncing(false);
        return;
      }

      void loadBootstrapEvent({ silent: true });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadBootstrapEvent({ silent: true });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [session]);

  const handleDialogOpen = (product = null) => {
    let prefill = { ...EMPTY_FORM };

    if (product) {
      prefill = { ...EMPTY_FORM, ...product };
    } else if (search.trim()) {
      const trimmedSearch = search.trim();
      const found = productDB.find(
        (entry) => entry.name.toLowerCase() === trimmedSearch.toLowerCase()
          || (entry.plu && entry.plu === trimmedSearch)
          || (entry.barcode && entry.barcode === trimmedSearch)
      );

      if (found) {
        prefill = { ...EMPTY_FORM, ...found, expiration: '' };
      } else if (/^\d+$/.test(trimmedSearch)) {
        prefill.barcode = trimmedSearch;
      } else {
        prefill.name = trimmedSearch;
      }
    }

    setEditProduct(product);
    setForm(prefill);
    setFormVisible(true);
  };

  const handleDialogClose = () => {
    resetFormState();
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const handleOpenCamera = () => {
    if (!window.isSecureContext) {
      setSnackbar({
        open: true,
        message: 'Taking photos requires the live HTTPS site.',
        severity: 'info',
      });
      return;
    }

    photoInputRef.current?.click();
  };

  const handlePhotoSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((currentForm) => ({ ...currentForm, photo: reader.result, photoPath: '' }));
      }
    };
    reader.onerror = () => {
      setSnackbar({ open: true, message: 'The photo could not be loaded.', severity: 'error' });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const openScanner = (target) => {
    if (!supportsLiveScanner) {
      setSnackbar({
        open: true,
        message: 'Live barcode scanning is not available on this phone or browser. Type the barcode manually instead.',
        severity: 'info',
      });
      return;
    }

    if (target === 'search') {
      setScanSearchOpen(true);
      return;
    }

    setScanDialogOpen(true);
  };

  const handleScanSearch = (_error, result) => {
    if (result?.text) {
      setSearch(result.text);
      setScanSearchOpen(false);
    }
  };

  const handleScanDialog = (_error, result) => {
    if (result?.text) {
      setForm((currentForm) => ({ ...currentForm, barcode: result.text }));
      setScanDialogOpen(false);
    }
  };

  const compressPhoto = async (dataUrl) => new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const maxDimension = 320;
      const scale = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
      const targetWidth = Math.max(Math.round(image.width * scale), 1);
      const targetHeight = Math.max(Math.round(image.height * scale), 1);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = dataUrl;
  });

  const handleLogin = async () => {
    if (!isSupabaseConfigured) {
      setSnackbar({ open: true, message: supabaseConfigError, severity: 'error' });
      return;
    }

    if (!loginForm.email.trim() || !loginForm.password) {
      setSnackbar({ open: true, message: 'Email and password are required.', severity: 'error' });
      return;
    }

    setAuthSubmitting(true);
    try {
      const payload = await signIn(loginForm);
      setSession(payload.session);
      applyBootstrapData(payload.data);
      setLoginForm(EMPTY_LOGIN_FORM);
      setSnackbar({ open: true, message: `Signed in as ${payload.session.displayName}.`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Login failed.', severity: 'error' });
    } finally {
      setAuthSubmitting(false);
      setAuthBooting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured) {
        await signOut();
      }
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not sign out cleanly.', severity: 'error' });
    }

    clearAppData();
    setDrawerOpen(false);
    setOperatorDialogOpen(false);
    setActivityDialogOpen(false);
    setDeleteConfirmProduct(null);
    resetFormState();
    setSnackbar({ open: true, message: 'Signed out.', severity: 'info' });
  };

  const handleSaveProduct = async () => {
    if (!form.name.trim() || !form.expiration) {
      setSnackbar({ open: true, message: 'Name and expiration are required.', severity: 'error' });
      return;
    }

    const trimmedName = form.name.trim();
    const existingProduct = productDB.find(
      (entry) => entry.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (!existingProduct && !form.photo) {
      setSnackbar({ open: true, message: 'Photo is required for new products.', severity: 'error' });
      return;
    }

    let photoToSave = form.photo;
    if (form.photo && form.photo.startsWith('data:image')) {
      photoToSave = await compressPhoto(form.photo);
    }

    try {
      const payload = await saveProduct({
        form: {
          ...form,
          name: trimmedName,
          photo: photoToSave,
        },
        editProductId: editProduct?.id || null,
      });

      setProducts(payload.dashboard || []);
      setProductDB(payload.productDB || []);
      if (isDeveloper && activityDialogOpen) {
        void loadActivityHistory();
      }
      resetFormState();
      setSearch('');
      setSnackbar({ open: true, message: editProduct ? 'Product updated.' : 'Product added.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not save the product.', severity: 'error' });
    }
  };

  const performDeleteProduct = async (product) => {
    try {
      const payload = await deleteDashboardItem(product.id);
      setProducts(payload.dashboard || []);
      setProductDB(payload.productDB || []);
      if (isDeveloper && activityDialogOpen) {
        void loadActivityHistory();
      }
      setDeleteConfirmProduct(null);
      setSnackbar({ open: true, message: 'Product deleted.', severity: 'info' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not delete the product.', severity: 'error' });
    }
  };

  const getProductStatus = (product) => {
    if (!product.expiration) {
      return { accent: '#5b5246', label: 'No date', helper: 'Needs expiration date', tone: '#cdbda4' };
    }

    const today = dayjs().startOf('day');
    const expirationDate = dayjs(product.expiration);
    const dayDifference = expirationDate.diff(today, 'day');

    if (dayDifference < 0) {
      return { accent: '#ef4444', label: 'Expired', helper: 'REMOVE FROM SHELF', tone: '#fecaca' };
    }
    if (dayDifference <= 1) {
      return { accent: '#f59e0b', label: 'Urgent', helper: 'MARKDOWN SOON', tone: '#fde68a' };
    }
    return { accent: '#22c55e', label: 'Fresh', helper: 'SAFE', tone: '#bbf7d0' };
  };

  const handleDeleteProduct = async (product) => {
    const status = getProductStatus(product);

    if (status.helper === 'SAFE') {
      setDeleteConfirmProduct(product);
      return;
    }

    await performDeleteProduct(product);
  };

  const handleWipeDashboard = async () => {
    if (!window.confirm('Clear the entire dashboard for everyone using this shared store?')) {
      return;
    }

    try {
      const payload = await clearDashboard();
      setProducts(payload.dashboard || []);
      setProductDB(payload.productDB || []);
      if (isDeveloper && activityDialogOpen) {
        void loadActivityHistory();
      }
      setSnackbar({ open: true, message: 'Dashboard cleared.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not clear the dashboard.', severity: 'error' });
    }
  };

  const handleWipeDatabase = async () => {
    if (!window.confirm('Clear the full product database and dashboard for everyone?')) {
      return;
    }

    try {
      const payload = await clearDatabase();
      setProducts(payload.dashboard || []);
      setProductDB(payload.productDB || []);
      if (isDeveloper && activityDialogOpen) {
        void loadActivityHistory();
      }
      setSnackbar({ open: true, message: 'Product database cleared.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not clear the product database.', severity: 'error' });
    }
  };

  const handleCreateOperator = async () => {
    if (!operatorForm.email.trim()) {
      setSnackbar({ open: true, message: 'Operator email is required.', severity: 'error' });
      return;
    }

    setOperatorSaving(true);
    try {
      const payload = await createOperator(operatorForm);
      setOperators(payload.operators || []);
      if (activityDialogOpen) {
        void loadActivityHistory();
      }
      setOperatorForm(EMPTY_OPERATOR_FORM);
      setSnackbar({ open: true, message: 'Operator login created.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not create the operator login.', severity: 'error' });
    } finally {
      setOperatorSaving(false);
    }
  };

  const handleToggleOperator = async (operator) => {
    try {
      const payload = await toggleOperatorActive(operator.id, !operator.active);
      setOperators(payload.operators || []);
      if (activityDialogOpen) {
        void loadActivityHistory();
      }
      setSnackbar({ open: true, message: operator.active ? 'Operator deactivated.' : 'Operator reactivated.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not update that operator.', severity: 'error' });
    }
  };

  const handleDeleteOperator = async (operator) => {
    if (!window.confirm(`Delete the login ${operator.email}?`)) {
      return;
    }

    try {
      const payload = await deleteOperator(operator.id);
      setOperators(payload.operators || []);
      if (activityDialogOpen) {
        void loadActivityHistory();
      }
      setSnackbar({ open: true, message: 'Operator deleted.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Could not delete that operator.', severity: 'error' });
    }
  };

  let filteredProducts = [...products].filter(
    (product) => product.name.toLowerCase().includes(search.toLowerCase())
      || (product.plu && product.plu.includes(search))
      || (product.barcode && product.barcode.includes(search))
  );

  if (sortBy === 'date') {
    filteredProducts.sort((leftProduct, rightProduct) => {
      if (!leftProduct.expiration) {
        return 1;
      }
      if (!rightProduct.expiration) {
        return -1;
      }
      return new Date(leftProduct.expiration) - new Date(rightProduct.expiration);
    });
  } else if (sortBy === 'name') {
    filteredProducts.sort((leftProduct, rightProduct) => leftProduct.name.localeCompare(rightProduct.name));
  }

  const formatActivityTime = (timestamp) => dayjs(timestamp).format('MMM D, YYYY h:mm A');

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      {!session && (
        <Box sx={{ minHeight: '100vh', px: 1.5, py: 3, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at top, rgba(249,115,22,0.18), transparent 34%), radial-gradient(circle at right, rgba(56,189,248,0.12), transparent 26%), linear-gradient(180deg, #080808 0%, #0d0d0f 38%, #050505 100%)' }}>
          <Box sx={{ width: '100%', maxWidth: 520, borderRadius: 4, border: '1px solid rgba(244,228,195,0.12)', background: 'linear-gradient(180deg, rgba(17,17,18,0.95), rgba(11,11,12,0.98))', boxShadow: '0 24px 48px rgba(0,0,0,0.36)', p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.6, mb: 2 }}>
              <Box component="img" src={crestSrc} alt="RJ crest" sx={{ width: 64, height: 64, borderRadius: '50%' }} />
              <Box>
                <Typography variant="h4" sx={{ color: '#f8f4eb', lineHeight: 1 }}>
                  ExpiryApp Login
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.6 }}>
              {!isSupabaseConfigured && (
                <Alert severity="warning" sx={{ background: alpha('#f59e0b', 0.14), color: '#fde68a', border: '1px solid rgba(245,158,11,0.28)' }}>
                  {supabaseConfigError}
                </Alert>
              )}
              <TextField
                label="Email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
                autoFocus
                fullWidth
                sx={fieldSx}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleLogin();
                  }
                }}
              />
              <TextField
                label="Password"
                type={showLoginPassword ? 'text' : 'password'}
                value={loginForm.password}
                onChange={(event) => setLoginForm((currentForm) => ({ ...currentForm, password: event.target.value }))}
                fullWidth
                sx={fieldSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowLoginPassword((currentValue) => !currentValue)}
                        sx={{ color: '#cabfae' }}
                      >
                        {showLoginPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleLogin();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={() => void handleLogin()}
                disabled={authSubmitting || authBooting || !isSupabaseConfigured}
                sx={{ ...actionButtonSx, mt: 0.5, background: 'linear-gradient(90deg, #f97316, #ef4444)', boxShadow: '0 12px 26px rgba(239,68,68,0.24)' }}
              >
                {authSubmitting || authBooting ? 'Signing in...' : 'Sign In'}
              </Button>
            </Box>

            {authBooting && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.2 }}>
                <CircularProgress size={26} sx={{ color: '#f97316' }} />
              </Box>
            )}
          </Box>
        </Box>
      )}

      {session && (
        <>
          <AppBar
            position="sticky"
            color="default"
            elevation={0}
            sx={{
              background: 'rgba(8, 8, 8, 0.92)',
              borderBottom: '1px solid rgba(244, 228, 195, 0.12)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <Toolbar sx={{ minHeight: 78, gap: 1.5 }}>
              <IconButton edge="start" color="inherit" aria-label="menu" onClick={() => setDrawerOpen(true)} sx={{ color: '#f8f4eb' }}>
                <MenuIcon />
              </IconButton>
              <Box component="img" src={crestSrc} alt="RJ crest" sx={{ width: 48, height: 48, borderRadius: '50%', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ color: '#f8f4eb', lineHeight: 1.1 }}>
                  Expiration Monitoring App
                </Typography>
                <Typography variant="body2" sx={{ color: '#cabfae' }}>
                  {session.displayName} · {isDeveloper ? 'Developer' : 'Staff'}
                </Typography>
              </Box>
              {!isMobile && (
                <Chip
                  label={syncing ? 'Syncing...' : `${products.length} tracked items`}
                  sx={{
                    background: alpha('#f97316', 0.12),
                    color: '#f8f4eb',
                    border: '1px solid rgba(249,115,22,0.35)',
                    fontWeight: 700,
                  }}
                />
              )}
              <Button onClick={() => void handleLogout()} sx={{ ...actionButtonSx, color: '#f8f4eb' }}>
                Log Out
              </Button>
            </Toolbar>
          </AppBar>

          <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <Box sx={{ width: 310, background: '#0e0e0f', color: '#f8f4eb', height: '100%' }} role="presentation">
              <Box sx={{ p: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box component="img" src={crestSrc} alt="RJ crest" sx={{ width: 54, height: 54 }} />
                <Box>
                  <Typography variant="h6">Control Center</Typography>
                  <Typography variant="body2" sx={{ color: '#cabfae' }}>{session.displayName}</Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mx: 2.5, mb: 2, color: '#cabfae' }}>
                {isDeveloper
                  ? 'Developer can create staff accounts and clear shared data for the whole store.'
                  : 'Staff users share the same inventory and product catalog through this app.'}
              </Typography>
              <Divider />
              <List>
                {isDeveloper && (
                  <ListItem button onClick={() => { setOperatorDialogOpen(true); setDrawerOpen(false); }} sx={{ py: 1.5 }}>
                    <ListItemText primary="Manage Logins" secondary="Create or disable named operator accounts" />
                  </ListItem>
                )}
                {isDeveloper && (
                  <ListItem button onClick={() => { setActivityDialogOpen(true); setDrawerOpen(false); void loadActivityHistory(); }} sx={{ py: 1.5 }}>
                    <ListItemText primary="Activity History" secondary="View the last 7 days of changes" />
                  </ListItem>
                )}
                {isDeveloper && (
                  <ListItem button onClick={() => { void handleWipeDashboard(); setDrawerOpen(false); }} sx={{ py: 1.5 }}>
                    <ListItemText primary="Clear Dashboard" secondary="Removes tracked expiration items for everyone" />
                  </ListItem>
                )}
                {isDeveloper && (
                  <ListItem button onClick={() => { void handleWipeDatabase(); setDrawerOpen(false); }} sx={{ py: 1.5 }}>
                    <ListItemText primary="Clear Product Database" secondary="Removes the master product catalog too" />
                  </ListItem>
                )}
                <ListItem button onClick={() => void handleLogout()} sx={{ py: 1.5 }}>
                  <ListItemText primary="Log Out" secondary="Ends this device session" />
                </ListItem>
              </List>
            </Box>
          </Drawer>

          <Box sx={{ px: { xs: 1.2, sm: 2.5, md: 4 }, py: { xs: 1.2, sm: 2.5 }, minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(249,115,22,0.18), transparent 34%), radial-gradient(circle at right, rgba(56,189,248,0.12), transparent 26%), linear-gradient(180deg, #080808 0%, #0d0d0f 38%, #050505 100%)' }}>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelected} style={{ display: 'none' }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: formVisible ? '1.15fr 0.95fr' : '1fr' }, alignItems: 'start', gap: 2.5, mb: 3 }}>
              <Box sx={{ p: { xs: 1.4, sm: 2 }, borderRadius: '10px', border: '1px solid rgba(244,228,195,0.12)', background: 'linear-gradient(180deg, rgba(17,17,18,0.95), rgba(11,11,12,0.98))', boxShadow: '0 18px 42px rgba(0,0,0,0.28)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1.2, mb: 1.6, textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ color: '#f8f4eb', fontWeight: 700 }}>
                    Product Finder
                  </Typography>
                  <Chip label={`${productDB.length} items in catalog`} sx={{ background: alpha('#38bdf8', 0.12), color: '#d9f4ff', border: '1px solid rgba(56,189,248,0.25)', fontWeight: 700 }} />
                </Box>

                <Autocomplete
                  freeSolo
                  options={productDB.map((product) => product.name).filter(Boolean)}
                  inputValue={search}
                  open={autocompleteOpen}
                  onInputChange={(_, value) => {
                    setSearch(value);
                    if (value && /^[a-zA-Z]/.test(value)) {
                      setAutocompleteOpen(true);
                    } else {
                      setAutocompleteOpen(false);
                    }
                  }}
                  onClose={() => setAutocompleteOpen(false)}
                  sx={{ width: '100%' }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search by name, PLU, or barcode"
                      variant="outlined"
                      size="medium"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleDialogOpen();
                        }
                      }}
                      sx={{ ...fieldSx, '& .MuiOutlinedInput-root': { borderRadius: '10px', background: 'rgba(247, 239, 224, 0.03)', color: '#f8f4eb', '& fieldset': { borderColor: 'rgba(244, 228, 195, 0.18)' }, '&:hover fieldset': { borderColor: 'rgba(249, 115, 22, 0.6)' }, '&.Mui-focused fieldset': { borderColor: '#f97316', borderWidth: 2 } }, '& input': { color: '#f8f4eb', fontSize: 20, fontWeight: 700 } }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            <IconButton color="primary" onClick={() => openScanner('search')} sx={{ color: '#38bdf8' }}>
                              <QrCodeScannerIcon />
                            </IconButton>
                            <IconButton color="primary" onClick={() => handleDialogOpen()} sx={{ ml: 0.5, color: '#f97316' }}>
                              <AddIcon />
                            </IconButton>
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Box>

              {formVisible && (
                <Box sx={{ borderRadius: 4, p: { xs: 1.6, sm: 2.2 }, border: '1px solid rgba(244,228,195,0.12)', background: 'linear-gradient(180deg, rgba(17,17,18,0.95), rgba(11,11,12,0.98))', boxShadow: '0 18px 42px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: '#f97316', fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                        {editProduct ? 'Update entry' : 'New shelf item'}
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#f8f4eb' }}>
                        {editProduct ? 'Edit Product' : 'Add Product'}
                      </Typography>
                    </Box>
                    <Box component="img" src={crestSrc} alt="RJ crest" sx={{ width: 68, height: 68, display: { xs: 'none', sm: 'block' } }} />
                  </Box>

                  <TextField label="Product Name" name="name" value={form.name} onChange={handleFormChange} fullWidth required autoFocus sx={fieldSx} />
                  <TextField label="PLU (optional)" name="plu" value={form.plu} onChange={handleFormChange} fullWidth sx={fieldSx} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField label="Barcode (optional)" name="barcode" value={form.barcode} onChange={handleFormChange} fullWidth sx={fieldSx} />
                    <IconButton color="primary" onClick={() => openScanner('form')} sx={{ color: '#38bdf8' }}>
                      <QrCodeScannerIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', p: 1.4, borderRadius: 4, background: 'rgba(248,244,235,0.03)', border: '1px solid rgba(244,228,195,0.08)' }}>
                    <Button variant="outlined" sx={{ ...actionButtonSx, flex: 1, minWidth: 0, borderColor: 'rgba(249,115,22,0.5)', color: '#f8f4eb' }} onClick={handleOpenCamera}>
                      {form.photo ? 'Retake Photo' : 'Take Photo'}
                    </Button>
                    {form.photo && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <img src={form.photo} alt="Preview" style={{ width: 112, height: 112, objectFit: 'cover', borderRadius: 12, border: '1.5px solid #f97316' }} />
                        <Button size="small" color="error" onClick={() => setForm((currentForm) => ({ ...currentForm, photo: '', photoPath: '' }))} sx={{ borderRadius: 999 }}>
                          Remove
                        </Button>
                      </Box>
                    )}
                  </Box>

                  <TextField label="Expiration Date" name="expiration" type="date" value={form.expiration} onChange={handleFormChange} fullWidth InputLabelProps={{ shrink: true }} required sx={fieldSx} onClick={(event) => { if (event.target.showPicker) { event.target.showPicker(); } }} />

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.4, mt: 1 }}>
                    <Button onClick={handleDialogClose} sx={{ ...actionButtonSx, color: '#cabfae' }}>Cancel</Button>
                    <Button
                      onClick={() => void handleSaveProduct()}
                      variant="contained"
                      sx={{ ...actionButtonSx, background: 'linear-gradient(90deg, #f97316, #ef4444)', boxShadow: '0 12px 26px rgba(239,68,68,0.24)' }}
                      disabled={!form.name.trim() || !form.expiration || (!editProduct && !productDB.find((product) => product.name.toLowerCase() === form.name.trim().toLowerCase()) && !form.photo)}
                    >
                      Save to shelf
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: '#38bdf8', fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                  Dashboard
                </Typography>
                <Typography variant="h4" sx={{ color: '#f8f4eb' }}>
                  Product Expiration List
                </Typography>
              </Box>
              <TextField select label="Sort By" value={sortBy} onChange={(event) => setSortBy(event.target.value)} size="medium" SelectProps={{ native: true }} sx={{ width: { xs: '100%', sm: 220 }, ...fieldSx }}>
                <option value="date">Expiration Date</option>
                <option value="name">Name</option>
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.8 }}>
              {filteredProducts.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center', borderRadius: 4, border: '1px dashed rgba(244,228,195,0.18)', background: 'rgba(248,244,235,0.02)' }}>
                  <Typography variant="h6" sx={{ color: '#f8f4eb', mb: 0.5 }}>No products found.</Typography>
                  <Typography color="text.secondary">Start by scanning or searching for an item above.</Typography>
                </Box>
              ) : (
                filteredProducts.map((product) => {
                  const status = getProductStatus(product);

                  return (
                    <Box key={product.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: product.photo ? '148px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto' }, alignItems: 'stretch', background: `linear-gradient(180deg, ${alpha(status.accent, 0.3)}, rgba(10,10,11,0.94))`, borderRadius: '10px', p: { xs: 1.8, sm: 2.1 }, border: `1px solid ${alpha(status.accent, 0.34)}`, boxShadow: `0 18px 42px ${alpha(status.accent, 0.14)}`, columnGap: 1.5, rowGap: 1.2, position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', inset: '0 auto 0 0', width: 7, background: status.accent } }}>
                      {product.photo && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={product.photo} alt={product.name} style={{ width: 148, height: 148, objectFit: 'cover', borderRadius: 12, boxShadow: '0 10px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(244,228,195,0.14)' }} />
                        </Box>
                      )}
                      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 0.9, flexDirection: { xs: 'column', sm: 'row' } }}>
                          <Typography variant="h5" sx={{ color: '#f8f4eb', fontSize: { xs: 24, sm: 28 }, fontWeight: 800, lineHeight: 1.05, letterSpacing: 0.1 }}>
                            {product.name}
                          </Typography>
                          <Chip label={status.label} sx={{ background: alpha(status.accent, 0.15), color: status.tone, border: `1px solid ${alpha(status.accent, 0.32)}`, fontWeight: 800, fontSize: 13, height: 30, px: 0.4 }} />
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                          <Box sx={{ px: 1.3, py: 1.05, borderRadius: 999, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <Typography sx={{ color: '#cabfae', fontSize: 11, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', mb: 0.35 }}>
                              PLU
                            </Typography>
                            <Typography sx={{ color: '#f8f4eb', fontSize: { xs: 18, sm: 20 }, fontWeight: 800, lineHeight: 1.05 }}>
                              {product.plu || '-'}
                            </Typography>
                          </Box>
                          <Box sx={{ px: 1.3, py: 1.05, borderRadius: 999, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <Typography sx={{ color: '#cabfae', fontSize: 11, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', mb: 0.35 }}>
                              Expiry Date
                            </Typography>
                            <Typography sx={{ color: '#f8f4eb', fontSize: { xs: 18, sm: 22 }, fontWeight: 800, lineHeight: 1.05 }}>
                              {product.expiration}
                            </Typography>
                          </Box>
                          <Box sx={{ px: 1.3, py: 1.05, borderRadius: 999, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <Typography sx={{ color: '#cabfae', fontSize: 11, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', mb: 0.35 }}>
                              Barcode
                            </Typography>
                            <Typography sx={{ color: '#f8f4eb', fontSize: { xs: 15, sm: 17 }, fontWeight: 700, lineHeight: 1.1, wordBreak: 'break-word' }}>
                              {product.barcode || '-'}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ mt: 0.15, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.2, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 13, color: status.tone, background: 'rgba(0,0,0,0.18)', borderRadius: 999, px: 1.25, py: 0.65, letterSpacing: 0.55, display: 'inline-flex', alignSelf: 'flex-start' }}>{status.helper}</Typography>
                          {product.updatedBy && (
                            <Typography variant="body2" sx={{ ml: 'auto', textAlign: 'right', color: '#cabfae', fontSize: 12, fontWeight: 700, letterSpacing: 0.2 }}>
                              Expiry set by {product.updatedBy}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 0.8, alignItems: 'center', justifyContent: { xs: 'flex-end', md: 'center' }, width: { xs: '100%', md: 'auto' }, mt: { xs: 0.2, md: 0 } }}>
                        <IconButton color="primary" onClick={() => handleDialogOpen(product)} size="large" sx={{ background: 'rgba(56,189,248,0.12)', color: '#d9f4ff', borderRadius: 3, p: 1.05, '&:hover': { background: 'rgba(56,189,248,0.22)' } }}>
                          <EditIcon sx={{ fontSize: 24 }} />
                        </IconButton>
                        <IconButton color="error" onClick={() => void handleDeleteProduct(product)} size="large" sx={{ background: 'rgba(239,68,68,0.12)', borderRadius: 3, p: 1.05, '&:hover': { background: 'rgba(239,68,68,0.22)' } }}>
                          <DeleteIcon sx={{ fontSize: 24 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>

            <Dialog open={operatorDialogOpen} onClose={() => setOperatorDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { background: '#101011', borderRadius: 4, color: '#f8f4eb' } }}>
              <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, pt: 2.2, pb: 1.1, px: 7 }}>
                Manage Staff Logins
              </DialogTitle>
              <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '10px !important' }}>
                <Alert severity="info" sx={{ background: alpha('#38bdf8', 0.12), color: '#d9f4ff', border: '1px solid rgba(56,189,248,0.28)' }}>
                  New staff accounts automatically use the shared password configured on the server. Disabled accounts cannot sign back in until they are re-enabled.
                </Alert>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr auto' }, gap: 1.2, alignItems: 'start' }}>
                  <TextField label="Email" value={operatorForm.email} onChange={(event) => setOperatorForm((currentForm) => ({ ...currentForm, email: event.target.value }))} fullWidth sx={fieldSx} />
                  <TextField label="Display Name" value={operatorForm.displayName} onChange={(event) => setOperatorForm((currentForm) => ({ ...currentForm, displayName: event.target.value }))} fullWidth sx={fieldSx} />
                  <Button variant="contained" onClick={() => void handleCreateOperator()} disabled={operatorSaving} sx={{ ...actionButtonSx, minHeight: 56, background: 'linear-gradient(90deg, #f97316, #ef4444)' }}>
                    Add Login
                  </Button>
                </Box>

                <Box sx={{ display: 'grid', gap: 1 }}>
                  {operators.length === 0 ? (
                    <Typography color="text.secondary">No operator logins yet.</Typography>
                  ) : (
                    operators.map((operator) => (
                      <Box key={operator.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' }, gap: 1.2, p: 1.4, borderRadius: 3, border: '1px solid rgba(244,228,195,0.08)', background: 'rgba(248,244,235,0.03)' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, color: '#f8f4eb' }}>
                            {operator.displayName || operator.email}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#cabfae' }}>
                            Email: {operator.email}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                          <Chip label={operator.active ? 'Active' : 'Disabled'} sx={{ background: operator.active ? alpha('#22c55e', 0.16) : alpha('#ef4444', 0.16), color: operator.active ? '#bbf7d0' : '#fecaca', border: `1px solid ${operator.active ? alpha('#22c55e', 0.3) : alpha('#ef4444', 0.3)}` }} />
                          <Button onClick={() => void handleToggleOperator(operator)} sx={{ ...actionButtonSx, px: 1.5, py: 0.7, color: '#f8f4eb' }}>
                            {operator.active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button color="error" onClick={() => void handleDeleteOperator(operator)} sx={{ ...actionButtonSx, px: 1.5, py: 0.7 }}>
                            Delete
                          </Button>
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2, pt: 0.5 }}>
                <Button onClick={() => setOperatorDialogOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>

            <Dialog open={activityDialogOpen} onClose={() => setActivityDialogOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { background: '#101011', borderRadius: 4, color: '#f8f4eb' } }}>
              <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, pt: 2.2, pb: 1.1, px: 7 }}>
                Activity History
              </DialogTitle>
              <DialogContent sx={{ display: 'grid', gap: 1.4, pt: '10px !important' }}>
                <Alert severity="info" sx={{ background: alpha('#38bdf8', 0.12), color: '#d9f4ff', border: '1px solid rgba(56,189,248,0.28)' }}>
                  Admin-only view. This list keeps the last 7 days of activity.
                </Alert>
                {activityLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} sx={{ color: '#f97316' }} />
                  </Box>
                ) : activities.length === 0 ? (
                  <Typography color="text.secondary">No activity recorded in the last 7 days.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1, maxHeight: '60vh', overflowY: 'auto', pr: 0.5 }}>
                    {activities.map((activity) => (
                      <Box key={activity.id} sx={{ p: 1.4, borderRadius: 3, border: '1px solid rgba(244,228,195,0.08)', background: 'rgba(248,244,235,0.03)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <Box>
                            <Typography sx={{ color: '#f8f4eb', fontWeight: 800 }}>
                              {activity.details || activity.action}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#cabfae', mt: 0.35 }}>
                              {activity.actor} · {activity.actorRole}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ color: '#cabfae', fontSize: 12, textAlign: 'right' }}>
                            {formatActivityTime(activity.timestamp)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2, pt: 0.5 }}>
                <Button onClick={() => setActivityDialogOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteConfirmProduct)} onClose={() => setDeleteConfirmProduct(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { background: '#101011', borderRadius: 4, color: '#f8f4eb' } }}>
              <DialogTitle>Delete SAFE Item?</DialogTitle>
              <DialogContent>
                <Typography sx={{ color: '#f8f4eb', mb: 1 }}>
                  {deleteConfirmProduct?.name} is currently marked SAFE.
                </Typography>
                <Typography variant="body2" sx={{ color: '#cabfae' }}>
                  Confirm deletion if you still want to remove this item from the dashboard.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeleteConfirmProduct(null)}>Cancel</Button>
                <Button color="error" variant="contained" onClick={() => void performDeleteProduct(deleteConfirmProduct)} sx={{ ...actionButtonSx, px: 1.8, py: 0.8 }}>
                  Delete Item
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog open={scanSearchOpen} onClose={() => setScanSearchOpen(false)} fullScreen={isMobile} scroll="body" PaperProps={{ sx: { background: '#101011', borderRadius: 4, color: '#f8f4eb' } }}>
              <DialogTitle>Scan Barcode for Search</DialogTitle>
              <DialogContent sx={{ position: 'relative', textAlign: 'center' }}>
                {supportsLiveScanner && (
                  <ScannerErrorBoundary resetKey={scanSearchOpen ? 'search-open' : 'search-closed'} fallback={<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Live scanning could not start on this browser. Enter the barcode manually below.</Typography>}>
                    <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                      <BarcodeScannerComponent width={isMobile ? 260 : 300} height={isMobile ? 260 : 300} onUpdate={handleScanSearch} />
                      <Box sx={{ position: 'absolute', top: 0, left: 0, width: isMobile ? 260 : 300, height: isMobile ? 260 : 300, border: '2px dashed #38bdf8', borderRadius: 2, pointerEvents: 'none', boxSizing: 'border-box' }} />
                    </Box>
                  </ScannerErrorBoundary>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Enter barcode manually if scanning does not start:</Typography>
                <TextField margin="dense" label="Barcode" value={search} onChange={(event) => setSearch(event.target.value)} fullWidth sx={{ mt: 1, ...fieldSx }} />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setScanSearchOpen(false)}>Cancel</Button>
              </DialogActions>
            </Dialog>

            <Dialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} fullScreen={isMobile} scroll="body" PaperProps={{ sx: { background: '#101011', borderRadius: 4, color: '#f8f4eb' } }}>
              <DialogTitle>Scan Barcode for Product</DialogTitle>
              <DialogContent sx={{ position: 'relative', textAlign: 'center' }}>
                {supportsLiveScanner && (
                  <ScannerErrorBoundary resetKey={scanDialogOpen ? 'form-open' : 'form-closed'} fallback={<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Live scanning could not start on this browser. Enter the barcode manually below.</Typography>}>
                    <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                      <BarcodeScannerComponent width={isMobile ? 260 : 300} height={isMobile ? 260 : 300} onUpdate={handleScanDialog} />
                      <Box sx={{ position: 'absolute', top: 0, left: 0, width: isMobile ? 260 : 300, height: isMobile ? 260 : 300, border: '2px dashed #38bdf8', borderRadius: 2, pointerEvents: 'none', boxSizing: 'border-box' }} />
                    </Box>
                  </ScannerErrorBoundary>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Enter barcode manually if scanning does not start:</Typography>
                <TextField margin="dense" label="Barcode" value={form.barcode} onChange={(event) => setForm((currentForm) => ({ ...currentForm, barcode: event.target.value }))} fullWidth sx={{ mt: 1, ...fieldSx }} />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setScanDialogOpen(false)}>Cancel</Button>
              </DialogActions>
            </Dialog>
          </Box>
        </>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar((currentState) => ({ ...currentState, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((currentState) => ({ ...currentState, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
