const express = require("express");
const path = require("path");
const mysql = require("mysql2");


const app = express();
const port = 3000;
// setting view engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware untuk parsing form
app.use(express.urlencoded({ extended: true }));

// static file (css, dll)
app.use(express.static(path.join(__dirname, 'public')));
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',        // isi kalau pakai password
    database: 'Chinook.db'  // ganti sesuai nama DB kamu
});


db.connect((err) => {
    if (err) {
        console.error('Error connect DB:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

// redirect ke /purchases
app.get('/', (req, res) => {
    res.redirect('/purchases');
});

// 1. LIST PRODUK + STOK
app.get('/products', (req, res) => {
    const sql = `
        SELECT p.id, p.name, p.price, s.qty AS stock
        FROM products p
        JOIN product_stocks s ON p.id = s.product_id
    `;
    db.query(sql, (err, results) => {
        if (err) return res.send('Error: ' + err);
        res.render('products', { products: results });
    });
});

// 2. FORM INPUT PEMBELIAN (CREATE)
app.get('/purchases/new', (req, res) => {
    // ambil list produk untuk dropdown
    db.query('SELECT * FROM products', (err, products) => {
        if (err) return res.send('Error: ' + err);
        res.render('new_purchase', { products });
    });
});


// 2. FORM INPUT PEMBELIAN (CREATE)
app.get('/purchases/new', (req, res) => {
    // ambil list produk untuk dropdown
    db.query('SELECT * FROM products', (err, products) => {
        if (err) return res.send('Error: ' + err);
        res.render('new_purchase', { products });
    });
});

// 2b. PROSES SIMPAN PEMBELIAN
app.post('/purchases', (req, res) => {
    const productId = req.body.product_id;
    const qty = parseInt(req.body.qty, 10);

    // ambil harga + cek stok
    const sqlProduct = `
        SELECT p.price, s.qty AS stock
        FROM products p
        JOIN product_stocks s ON p.id = s.product_id
        WHERE p.id = ?
    `;
    db.query(sqlProduct, [productId], (err, results) => {
        if (err) return res.send('Error: ' + err);
        if (results.length === 0) return res.send('Produk tidak ditemukan');

        const price = results[0].price;
        const stock = results[0].stock;

        if (qty > stock) {
            return res.send('Stok tidak cukup!');
        }

        const totalPrice = price * qty;

        // insert ke tabel purchases
        const insertPurchase = `
            INSERT INTO purchases (product_id, qty, total_price, status)
            VALUES (?, ?, ?, 'ACTIVE')
        `;
        db.query(insertPurchase, [productId, qty, totalPrice], (err2, resultInsert) => {
            if (err2) return res.send('Error insert purchase: ' + err2);

            // update stok
            const updateStock = `
                UPDATE product_stocks
                SET qty = qty - ?
                WHERE product_id = ?
            `;
            db.query(updateStock, [qty, productId], (err3) => {
                if (err3) return res.send('Error update stock: ' + err3);

                res.redirect('/purchases');
            });
        });
    });
});

// 3. LIST PEMBELIAN
app.get('/purchases', (req, res) => {
    const sql = `
        SELECT pur.id, pur.qty, pur.total_price, pur.status, pur.created_at,
               p.name AS product_name
        FROM purchases pur
        JOIN products p ON pur.product_id = p.id
        ORDER BY pur.created_at DESC
    `;
    db.query(sql, (err, purchases) => {
        if (err) return res.send('Error: ' + err);
        res.render('purchases', { purchases });
    });
});

// 4. CANCEL PEMBELIAN (ADMIN)
app.post('/purchases/:id/cancel', (req, res) => {
    const purchaseId = req.params.id;

    // ambil data pembelian dulu untuk balikin stok
    const sqlGet = 'SELECT * FROM purchases WHERE id = ?';
    db.query(sqlGet, [purchaseId], (err, results) => {
        if (err) return res.send('Error: ' + err);
        if (results.length === 0) return res.send('Pembelian tidak ditemukan');

        const purchase = results[0];

        if (purchase.status === 'CANCELLED') {
            return res.redirect('/purchases');
        }

        // update status jadi CANCELLED
        const sqlUpdate = `
            UPDATE purchases
            SET status = 'CANCELLED'
            WHERE id = ?
        `;
        db.query(sqlUpdate, [purchaseId], (err2) => {
            if (err2) return res.send('Error update: ' + err2);

            // balikin stok
            const sqlRestock = `
                UPDATE product_stocks
                SET qty = qty + ?
                WHERE product_id = ?
            `;
            db.query(sqlRestock, [purchase.qty, purchase.product_id], (err3) => {
                if (err3) return res.send('Error restock: ' + err3);

                res.redirect('/purchases');
            });
        });
    });
});

// JALANKAN SERVER
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
