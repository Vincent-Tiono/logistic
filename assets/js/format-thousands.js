function formatThousands(v){
  const n = parseFloat(v);
  if (isNaN(n)) return (v ?? '0').toString();
  const parts = n.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
