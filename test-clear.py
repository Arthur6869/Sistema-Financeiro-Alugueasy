#!/usr/bin/env python3
"""Script para testar limpeza de dados"""
import subprocess
import json

def test_clear():
    print("=== Testando limpeza de dados ===\n")
    
    # Testar delete via curl (PowerShell)
    cmd = 'curl.exe -X DELETE "http://localhost:3000/api/clear?mes=1&ano=2026" -H "Content-Type: application/json"'
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        print(f"Status: {result.returncode}")
        print(f"Saída:\n{result.stdout}")
        if result.stderr:
            print(f"Erro:\n{result.stderr}")
            
        # Tentar parsear como JSON
        if result.stdout:
            try:
                data = json.loads(result.stdout)
                print(f"\nResultado da limpeza:")
                print(json.dumps(data, indent=2, ensure_ascii=False))
            except:
                print("\nNão conseguiu parsear como JSON")
    except subprocess.TimeoutExpired:
        print("Requisição expirou")
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    test_clear()
