const fs = require('fs');
const path = require('path');

async function testImport() {
  const files = [
    { name: '_  COFERENCIA DE CUSTOS - ADM - JAN (1).xlsx', tipo: 'custos_adm' },
    { name: '_  COFERENCIA DE DIARIAS - ADM - JAN.xlsx', tipo: 'diarias_adm' },
    { name: '_ COFERENCIA DE CUSTOS - SUB - JAN.xlsx', tipo: 'custos_sub' },
    { name: '_ COFERENCIA DE DIARIAS - SUB - JAN.xlsx', tipo: 'diarias_sub' }
  ];

  for (const f of files) {
    console.log(`Enviando ${f.name}...`);
    try {
      const filePath = path.join(process.cwd(), f.name);
      if (!fs.existsSync(filePath)) {
        console.error(`Arquivo no encontrado: ${f.name}`);
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const formData = new FormData();
      formData.append('file', blob, f.name);
      formData.append('tipo', f.tipo);

      const response = await fetch('http://localhost:3000/api/import', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      console.log(`Resultado para ${f.name}:`, JSON.stringify(result));
    } catch (err) {
      console.error(`Erro ao enviar ${f.name}:`, err.message);
    }
  }
}

testImport();
