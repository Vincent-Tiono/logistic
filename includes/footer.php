</div> <!-- end .app -->

<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script>
/* ===============================
   SIDEBAR TOGGLE (YouTube-style)
================================ */
(function(){
  const btn = document.getElementById('btnToggle');
  const KEY = 'mlp_sidebar_collapsed';

  // Load saved sidebar state
  try{
    if (localStorage.getItem(KEY) === '1') {
      document.body.classList.add('sidebar-collapsed');
    }
  }catch(e){}

  if (btn) {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      try{
        localStorage.setItem(
          KEY,
          document.body.classList.contains('sidebar-collapsed') ? '1' : '0'
        );
      }catch(e){}
    });
  }
})();

/* ===============================
   SUBMENU TOGGLE (Operation)
   + Save open state
================================ */
(function(){
  const SUBKEY = 'mlp_opSub_open';

  // expose globally (dipanggil dari sidebar onclick)
  window.toggleSubmenu = function(id){
    const el = document.getElementById(id);
    if (!el) return;

    const current = window.getComputedStyle(el).display;
    const next = (current === 'none') ? 'block' : 'none';
    el.style.display = next;

    // simpan state khusus opSub
    if (id === 'opSub') {
      try{
        localStorage.setItem(SUBKEY, (next === 'block') ? '1' : '0');
      }catch(e){}
    }
  };

  // Apply saved state (kalau ada). Kalau belum ada state, jangan override default dari server.
  const el = document.getElementById('opSub');
  if (!el) return;

  try{
    const saved = localStorage.getItem(SUBKEY); // '1' | '0' | null
    if (saved === '1') el.style.display = 'block';
    if (saved === '0') el.style.display = 'none';
  }catch(e){}
})();
</script>

</body>
</html>
