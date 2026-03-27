import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import { ThemeProvider, alpha, createTheme } from '@mui/material/styles';
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
  const crestSrc = `${import.meta.env.BASE_URL}rj-crest.png`;
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
  const [scanSearchOpen, setScanSearchOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const photoInputRef = useRef(null);
  const supportsLiveScanner = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia);

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
        setForm((currentForm) => ({ ...currentForm, photo: reader.result }));
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

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
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
          </Box>
          {!isMobile && (
            <Chip
              label={`${products.length} tracked items`}
              sx={{
                background: alpha('#f97316', 0.12),
                color: '#f8f4eb',
                border: '1px solid rgba(249,115,22,0.35)',
                fontWeight: 700,
              }}
            />
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 290, background: '#0e0e0f', color: '#f8f4eb', height: '100%' }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <Box sx={{ p: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box component="img" src={crestSrc} alt="RJ crest" sx={{ width: 54, height: 54 }} />
            <Box>
              <Typography variant="h6">Control Center</Typography>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ mx: 2.5, mb: 2, color: '#cabfae' }}>
            Use these only when you want to clear the shelf view or reset the full product catalog.
          </Typography>
          <Divider />
          <List>
            <ListItem button onClick={handleWipeDashboard} sx={{ py: 1.5 }}>
              <ListItemText primary="Clear Dashboard" secondary="Removes tracked expiration items only" />
            </ListItem>
            <ListItem button onClick={handleWipeDatabase} sx={{ py: 1.5 }}>
              <ListItemText primary="Clear Product Database" secondary="Removes the master product catalog too" />
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
                    <img src={form.photo} alt="Preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, border: '1.5px solid #f97316' }} />
                    <Button size="small" color="error" onClick={() => setForm((currentForm) => ({ ...currentForm, photo: '' }))} sx={{ borderRadius: 999 }}>
                      Remove
                    </Button>
                  </Box>
                )}
              </Box>

              <TextField label="Quantity" name="quantity" type="number" value={form.quantity} onChange={handleFormChange} fullWidth required sx={fieldSx} inputProps={{ min: 1 }} />
              <TextField label="Expiration Date" name="expiration" type="date" value={form.expiration} onChange={handleFormChange} fullWidth InputLabelProps={{ shrink: true }} required sx={fieldSx} onClick={(event) => { if (event.target.showPicker) { event.target.showPicker(); } }} />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.4, mt: 1 }}>
                <Button onClick={handleDialogClose} sx={{ ...actionButtonSx, color: '#cabfae' }}>Cancel</Button>
                <Button
                  onClick={handleSaveProduct}
                  variant="contained"
                  sx={{ ...actionButtonSx, background: 'linear-gradient(90deg, #f97316, #ef4444)', boxShadow: '0 12px 26px rgba(239,68,68,0.24)' }}
                  disabled={!form.name.trim() || !form.quantity || !form.expiration || (!editProduct && !productDB.find((product) => product.name.toLowerCase() === form.name.trim().toLowerCase()) && !form.photo)}
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
                <Box key={product.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: product.photo ? '112px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto' }, alignItems: 'stretch', background: `linear-gradient(180deg, ${alpha(status.accent, 0.3)}, rgba(10,10,11,0.94))`, borderRadius: '10px', p: { xs: 1.8, sm: 2.1 }, border: `1px solid ${alpha(status.accent, 0.34)}`, boxShadow: `0 18px 42px ${alpha(status.accent, 0.14)}`, columnGap: 1.5, rowGap: 1.2, position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', inset: '0 auto 0 0', width: 7, background: status.accent } }}>
                  {product.photo && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={product.photo} alt={product.name} style={{ width: 112, height: 112, objectFit: 'cover', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(244,228,195,0.14)' }} />
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
                      <Box sx={{ px: 1.3, py: 1.05, borderRadius: 999, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Typography sx={{ color: '#cabfae', fontSize: 11, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', mb: 0.35 }}>
                          Quantity
                        </Typography>
                        <Typography sx={{ color: '#f8f4eb', fontSize: { xs: 17, sm: 19 }, fontWeight: 800, lineHeight: 1.05 }}>
                          {product.quantity}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="body2" sx={{ mt: 0.15, fontWeight: 800, fontSize: 13, color: status.tone, background: 'rgba(0,0,0,0.18)', borderRadius: 999, px: 1.25, py: 0.65, letterSpacing: 0.55, display: 'inline-flex', alignSelf: 'flex-start' }}>{status.helper}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 0.8, alignItems: 'center', justifyContent: { xs: 'flex-end', md: 'center' }, width: { xs: '100%', md: 'auto' }, mt: { xs: 0.2, md: 0 } }}>
                    <IconButton color="primary" onClick={() => handleDialogOpen(product)} size="large" sx={{ background: 'rgba(56,189,248,0.12)', color: '#d9f4ff', borderRadius: 3, p: 1.05, '&:hover': { background: 'rgba(56,189,248,0.22)' } }}>
                      <EditIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteProduct(product.id)} size="large" sx={{ background: 'rgba(239,68,68,0.12)', borderRadius: 3, p: 1.05, '&:hover': { background: 'rgba(239,68,68,0.22)' } }}>
                      <DeleteIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

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

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((currentState) => ({ ...currentState, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((currentState) => ({ ...currentState, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
