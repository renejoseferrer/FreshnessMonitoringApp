import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MenuIcon from '@mui/icons-material/Menu';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';

const EMPTY_FORM = {
  name: '',
  plu: '',
  barcode: '',
  photo: '',
  quantity: '',
  expiration: '',
};

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#181818',
      paper: '#232323',
    },
    primary: {
      main: '#4f8cff',
    },
    secondary: {
      main: '#fbbf24',
    },
    error: {
      main: '#f87171',
    },
    success: {
      main: '#34d399',
    },
    text: {
      primary: '#fff',
      secondary: '#b0b0b0',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      'Roboto',
      'SF Pro',
      'Segoe UI',
      'system-ui',
      'sans-serif',
    ].join(','),
    h6: { fontWeight: 700 },
    body1: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 10,
  },
});

const readStoredArray = (key) => {
  try {
    const savedValue = localStorage.getItem(key);
    if (!savedValue) {
      return [];
    }
    const parsedValue = JSON.parse(savedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [products, setProducts] = useState(() => readStoredArray('dashboard'));
  const [productDB, setProductDB] = useState(() => readStoredArray('productDB'));
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanSearchOpen, setScanSearchOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const supportsLiveScanner = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia);
  const supportsSecureCamera = supportsLiveScanner;

  useEffect(() => {
    try {
      localStorage.setItem('dashboard', JSON.stringify(products));
    } catch {
      setSnackbar({ open: true, message: 'Could not save dashboard data on this device.', severity: 'warning' });
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('productDB', JSON.stringify(productDB));
    } catch {
      setSnackbar({ open: true, message: 'Could not save product database on this device.', severity: 'warning' });
    }
  }, [productDB]);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const resetFormState = () => {
    setForm(EMPTY_FORM);
    setEditProduct(null);
    setFormVisible(false);
    setScanDialogOpen(false);
  };

  const handleDialogOpen = (product = null) => {
    let prefill = { ...EMPTY_FORM };

    if (product) {
      prefill = { ...product };
    } else if (search.trim()) {
      const trimmedSearch = search.trim();
      const found = productDB.find(
        (entry) => entry.name.toLowerCase() === trimmedSearch.toLowerCase()
          || (entry.plu && entry.plu === trimmedSearch)
          || (entry.barcode && entry.barcode === trimmedSearch)
      );

      if (found) {
        prefill = { ...found, quantity: '', expiration: '' };
      } else if (/^\d+$/.test(trimmedSearch)) {
        prefill.plu = trimmedSearch;
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

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCloseCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
  };

  const handleOpenCamera = async () => {
    if (!supportsSecureCamera) {
      setSnackbar({
        open: true,
        message: 'Taking photos requires a secure live site. Deploy to GitHub Pages or use HTTPS to enable the camera.',
        severity: 'info',
      });
      return;
    }

    try {
      const cameraConstraints = [
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let mediaStream = null;
      for (const constraints of cameraConstraints) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch {
          mediaStream = null;
        }
      }

      if (!mediaStream) {
        throw new Error('Camera unavailable');
      }

      stopCameraStream();
      streamRef.current = mediaStream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch {
      setSnackbar({
        open: true,
        message: 'The camera could not be opened on this device.',
        severity: 'error',
      });
      handleCloseCamera();
    }
  };

  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setSnackbar({ open: true, message: 'Could not capture the photo.', severity: 'error' });
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    setForm((currentForm) => ({ ...currentForm, photo: canvas.toDataURL('image/jpeg', 0.9) }));
    handleCloseCamera();
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
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 96, 96);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    image.src = dataUrl;
  });

  const handleSaveProduct = async () => {
    if (!form.name.trim() || !form.quantity || !form.expiration) {
      setSnackbar({ open: true, message: 'Name, quantity, and expiration are required.', severity: 'error' });
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
    if (form.photo) {
      photoToSave = await compressPhoto(form.photo);
    }

    setProductDB((previousProducts) => {
      const exists = previousProducts.find(
        (entry) => entry.name.toLowerCase() === trimmedName.toLowerCase()
      );
      const masterRecord = {
        name: trimmedName,
        plu: form.plu,
        barcode: form.barcode,
        photo: photoToSave || exists?.photo || '',
      };

      if (exists) {
        return previousProducts.map((entry) => (
          entry.name.toLowerCase() === trimmedName.toLowerCase() ? masterRecord : entry
        ));
      }

      return [...previousProducts, masterRecord];
    });

    if (editProduct) {
      setProducts((previousProducts) => previousProducts.map((product) => (
        product.id === editProduct.id
          ? {
              ...product,
              ...form,
              name: trimmedName,
              photo: photoToSave || product.photo,
              id: editProduct.id,
            }
          : product
      )));
      setSnackbar({ open: true, message: 'Product updated.', severity: 'success' });
    } else {
      setProducts((previousProducts) => [
        ...previousProducts,
        {
          ...form,
          name: trimmedName,
          photo: photoToSave,
          id: Date.now(),
        },
      ]);
      setSnackbar({ open: true, message: 'Product added.', severity: 'success' });
    }

    resetFormState();
    setSearch('');
  };

  const handleDeleteProduct = (id) => {
    setProducts((previousProducts) => previousProducts.filter((product) => product.id !== id));
    setSnackbar({ open: true, message: 'Product deleted.', severity: 'info' });
  };

  const handleWipeDashboard = () => setProducts([]);
  const handleWipeDatabase = () => {
    setProducts([]);
    setProductDB([]);
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

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppBar position="static" color="default" sx={{ background: '#232323' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Expiration Monitoring App
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 250, background: '#232323', height: '100%' }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <Typography variant="h6" sx={{ m: 2 }}>
            Actions
          </Typography>
          <Divider />
          <List>
            <ListItem button onClick={handleWipeDashboard}>
              <ListItemText primary="Wipe Dashboard" />
            </ListItem>
            <ListItem button onClick={handleWipeDatabase}>
              <ListItemText primary="Wipe Database" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box sx={{ p: { xs: 1, sm: 3 }, background: '#181818', minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, mb: 3, gap: 2 }}>
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
            sx={{ flex: 1, minWidth: 220 }}
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
                sx={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 2,
                  input: { color: '#fff', fontSize: 18, fontWeight: 500 },
                  boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#4f8cff' },
                    '&.Mui-focused fieldset': { borderColor: '#4f8cff', borderWidth: 2 },
                  },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      <IconButton color="primary" onClick={() => openScanner('search')}>
                        <QrCodeScannerIcon />
                      </IconButton>
                      <IconButton color="primary" onClick={() => handleDialogOpen()} sx={{ ml: 0.5 }}>
                        <AddIcon />
                      </IconButton>
                    </>
                  ),
                }}
              />
            )}
          />

          {formVisible && (
            <Box sx={{
              background: '#232323',
              borderRadius: 2,
              p: 2,
              mb: 3,
              boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
              maxWidth: 520,
              width: '100%',
              mx: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', pb: 1 }}>
                {editProduct ? 'Edit Product' : 'Add Product'}
              </Typography>

              <TextField
                label="Product Name"
                name="name"
                value={form.name}
                onChange={handleFormChange}
                fullWidth
                required
                autoFocus
                sx={{ background: '#232323', borderRadius: 1 }}
              />

              <TextField
                label="PLU (optional)"
                name="plu"
                value={form.plu}
                onChange={handleFormChange}
                fullWidth
                sx={{ background: '#232323', borderRadius: 1 }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  label="Barcode (optional)"
                  name="barcode"
                  value={form.barcode}
                  onChange={handleFormChange}
                  fullWidth
                  sx={{ background: '#232323', borderRadius: 1 }}
                />
                <IconButton color="primary" onClick={() => openScanner('form')}>
                  <QrCodeScannerIcon />
                </IconButton>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="outlined" sx={{ flex: 1, minWidth: 0 }} onClick={handleOpenCamera}>
                  {form.photo ? 'Retake Photo' : 'Take Photo'}
                </Button>
                {form.photo && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img src={form.photo} alt="Preview" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #1a73e8' }} />
                    <Button size="small" color="error" onClick={() => setForm((currentForm) => ({ ...currentForm, photo: '' }))}>
                      Remove
                    </Button>
                  </Box>
                )}
              </Box>

              <TextField
                label="Quantity"
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={handleFormChange}
                fullWidth
                required
                sx={{ background: '#232323', borderRadius: 1 }}
                inputProps={{ min: 1 }}
              />

              <TextField
                label="Expiration Date"
                name="expiration"
                type="date"
                value={form.expiration}
                onChange={handleFormChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
                sx={{ background: '#232323', borderRadius: 1 }}
                onClick={(event) => {
                  if (event.target.showPicker) {
                    event.target.showPicker();
                  }
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                <Button onClick={handleDialogClose} sx={{ fontWeight: 600 }}>Cancel</Button>
                <Button
                  onClick={handleSaveProduct}
                  variant="contained"
                  sx={{ fontWeight: 600 }}
                  disabled={
                    !form.name.trim()
                    || !form.quantity
                    || !form.expiration
                    || (!editProduct
                      && !productDB.find((product) => product.name.toLowerCase() === form.name.trim().toLowerCase())
                      && !form.photo)
                  }
                >
                  Save
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', flex: 1, fontFamily: 'inherit' }}>
            Product Expiration List
          </Typography>
          <TextField
            select
            label="Sort By"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            size="medium"
            SelectProps={{ native: true }}
            sx={{
              width: { xs: '100%', sm: 200 },
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 2,
              fontSize: 18,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#444' },
                '&:hover fieldset': { borderColor: '#4f8cff' },
                '&.Mui-focused fieldset': { borderColor: '#4f8cff', borderWidth: 2 },
              },
              color: '#fff',
            }}
          >
            <option value="date">Expiration Date</option>
            <option value="name">Name</option>
          </TextField>
        </Box>

        <Box>
          {filteredProducts.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>No products found.</Typography>
          ) : (
            filteredProducts.map((product) => {
              let accent = '#232323';
              let statusMsg = '';
              let statusColor = '#fff';
              const today = dayjs().startOf('day');
              const expirationDate = dayjs(product.expiration);
              const dayDifference = expirationDate.diff(today, 'day');

              if (!product.expiration) {
                accent = '#232323';
              } else if (dayDifference < 0) {
                accent = '#f87171';
                statusMsg = 'EXPIRED: Remove expired products';
                statusColor = '#f87171';
              } else if (dayDifference === 0 || dayDifference === 1) {
                accent = '#fbbf24';
                statusMsg = 'MARKDOWN: Markdown soon to expire';
                statusColor = '#fbbf24';
              } else {
                accent = '#34d399';
                statusMsg = 'SAFE';
                statusColor = '#34d399';
              }

              return (
                <Box key={product.id} sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  background: 'rgba(36,36,40,0.98)',
                  borderRadius: 2.5,
                  p: 2,
                  mb: 2,
                  boxShadow: '0 4px 16px 0 rgba(0,0,0,0.18)',
                  gap: 2,
                  position: 'relative',
                  borderLeft: `8px solid ${accent}`,
                  minHeight: 110,
                }}>
                  {product.photo && (
                    <img src={product.photo} alt={product.name} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, marginRight: isMobile ? 0 : 18, marginBottom: isMobile ? 12 : 0, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: 22, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: { xs: 'normal', sm: 'nowrap' }, fontFamily: 'inherit' }}>{product.name}</Typography>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'flex-start', sm: 'center' }, mt: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#b0b0b0', fontWeight: 500 }}>
                        PLU: <span style={{ color: '#fff', fontWeight: 600 }}>{product.plu || '-'}</span>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#b0b0b0', fontWeight: 500 }}>
                        Barcode: <span style={{ color: '#fff', fontWeight: 600 }}>{product.barcode || '-'}</span>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'flex-start', sm: 'center' } }}>
                      <Typography variant="body2" sx={{ color: '#b0b0b0', fontWeight: 500 }}>
                        Qty: <span style={{ color: '#fff', fontWeight: 600 }}>{product.quantity}</span>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#b0b0b0', fontWeight: 500 }}>
                        Exp: <span style={{ color: '#fff', fontWeight: 600 }}>{product.expiration}</span>
                      </Typography>
                    </Box>
                    {statusMsg && (
                      <Typography variant="body2" sx={{ mt: 1, fontWeight: 700, color: statusColor, background: 'rgba(0,0,0,0.10)', borderRadius: 1, px: 1, py: 0.5, letterSpacing: 0.5 }}>
                        {statusMsg}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-end', sm: 'center' }, width: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}>
                    <IconButton color="primary" onClick={() => handleDialogOpen(product)} size="large" sx={{ background: 'rgba(79,140,255,0.10)', borderRadius: 2, '&:hover': { background: 'rgba(79,140,255,0.18)' } }}>
                      <EditIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteProduct(product.id)} size="large" sx={{ background: 'rgba(248,113,113,0.10)', borderRadius: 2, '&:hover': { background: 'rgba(248,113,113,0.18)' } }}>
                      <DeleteIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        <Dialog open={scanSearchOpen} onClose={() => setScanSearchOpen(false)} fullScreen={isMobile} scroll="body">
          <DialogTitle>Scan Barcode for Search</DialogTitle>
          <DialogContent sx={{ position: 'relative', textAlign: 'center' }}>
            {supportsLiveScanner && (
              <ScannerErrorBoundary
                resetKey={scanSearchOpen ? 'search-open' : 'search-closed'}
                fallback={
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Live scanning could not start on this browser. Enter the barcode manually below.
                  </Typography>
                }
              >
                <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <BarcodeScannerComponent width={isMobile ? 260 : 300} height={isMobile ? 260 : 300} onUpdate={handleScanSearch} />
                  <Box sx={{ position: 'absolute', top: 0, left: 0, width: isMobile ? 260 : 300, height: isMobile ? 260 : 300, border: '2px dashed #1a73e8', borderRadius: 2, pointerEvents: 'none', boxSizing: 'border-box' }} />
                </Box>
              </ScannerErrorBoundary>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enter barcode manually if scanning does not start:
            </Typography>
            <TextField margin="dense" label="Barcode" value={search} onChange={(event) => setSearch(event.target.value)} fullWidth sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setScanSearchOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} fullScreen={isMobile} scroll="body">
          <DialogTitle>Scan Barcode for Product</DialogTitle>
          <DialogContent sx={{ position: 'relative', textAlign: 'center' }}>
            {supportsLiveScanner && (
              <ScannerErrorBoundary
                resetKey={scanDialogOpen ? 'form-open' : 'form-closed'}
                fallback={
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Live scanning could not start on this browser. Enter the barcode manually below.
                  </Typography>
                }
              >
                <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <BarcodeScannerComponent width={isMobile ? 260 : 300} height={isMobile ? 260 : 300} onUpdate={handleScanDialog} />
                  <Box sx={{ position: 'absolute', top: 0, left: 0, width: isMobile ? 260 : 300, height: isMobile ? 260 : 300, border: '2px dashed #1a73e8', borderRadius: 2, pointerEvents: 'none', boxSizing: 'border-box' }} />
                </Box>
              </ScannerErrorBoundary>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enter barcode manually if scanning does not start:
            </Typography>
            <TextField margin="dense" label="Barcode" value={form.barcode} onChange={(event) => setForm((currentForm) => ({ ...currentForm, barcode: event.target.value }))} fullWidth sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setScanDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={cameraOpen} onClose={handleCloseCamera} fullScreen={isMobile} scroll="body" maxWidth="sm" fullWidth>
          <DialogTitle>Take Product Photo</DialogTitle>
          <DialogContent sx={{ textAlign: 'center' }}>
            <Box sx={{ borderRadius: 2, overflow: 'hidden', background: '#111', minHeight: 240 }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', display: 'block', aspectRatio: '4 / 3', objectFit: 'cover' }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              The app asks for the rear camera first when your phone/browser allows it.
            </Typography>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCamera}>Cancel</Button>
            <Button variant="contained" onClick={handleTakePhoto}>Capture</Button>
          </DialogActions>
        </Dialog>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((currentState) => ({ ...currentState, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((currentState) => ({ ...currentState, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
