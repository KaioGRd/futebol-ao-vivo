@AGENTS.md

# Projeto: FutebolAoVivo

## Repositório GitHub

- **URL:** https://github.com/KaioGRd/futebol-ao-vivo
- **Branch principal:** master
- **Usuário:** KaioGRd

## Sincronização Automática com GitHub

Todo arquivo editado ou criado neste projeto é automaticamente commitado e enviado ao GitHub via hook configurado em `.claude/settings.json`.

### Como funciona

O hook `PostToolUse` dispara após cada uso das ferramentas `Edit` ou `Write`:
1. Verifica se o arquivo alterado pertence ao projeto `futebol-ao-vivo`
2. Executa `git add -A`
3. Cria um commit com mensagem `auto: update YYYY-MM-DDTHH:MM:SS`
4. Faz `git push` para o GitHub

### Configuração do hook

Arquivo: `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "async": true,
        "statusMessage": "Sincronizando com GitHub...",
        "command": "..."
      }]
    }]
  }
}
```

### Pré-requisitos

- Git configurado: `git config --global user.name` e `user.email`
- GitHub CLI autenticado: `gh auth login`
- jq instalado em: `C:/Users/kaiog/AppData/Local/Microsoft/WinGet/Packages/jqlang.jq_Microsoft.Winget.Source_8wekyb3d8bbwe/jq.exe`

### Comandos úteis

```bash
# Ver histórico de commits automáticos
git log --oneline

# Ver status atual
git status

# Forçar push manual caso necessário
git push
```

> Se o hook parar de funcionar, verifique se o `gh auth status` ainda está autenticado e se o caminho do jq está correto.
