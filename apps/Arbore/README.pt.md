# Arbore — genealogia local

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · **Português** · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versão:** 1.0.0 · **Última atualização:** 2026-10-14

O Arbore é um programa de genealogia que funciona inteiramente no navegador: pessoas (vários nomes, nomes de solteira, datas incompletas, locais, profissões, eventos próprios, notas, fontes, etiquetas, pequenas fotografias), famílias (parceiros, tipo de união, filhos biológicos/adotados/enteados, casamento e divórcio), importação/exportação GEDCOM 5.5.1, diagramas SVG (ascendência em 3 a 7 gerações, descendência, ampulheta, leque), ficha pessoal, cronologia, lista de locais, calculadora de parentesco com a terminologia romena e verificações da qualidade dos dados (duplicados, incoerências, fusão com anulação).

![captura de ecrã](screenshot.png)

**Aplicação online:** https://chiuta.github.io/apps/Arbore/

## Como se utiliza

1. Prima **Carregar exemplo** (uma família fictícia) ou **Dados e exportação → Importar** para um ficheiro `.ged` / `.fff.json`; ou adicione pessoas com **+ Pessoa**.
2. **Pessoas**: pesquisa (nome, ano, local, etiqueta), filtros, ficha pessoal com eventos, pais, irmãos, uniões e filhos.
3. **Diagramas**: escolha a pessoa de base, o tipo e o número de gerações. Setas = navegação entre pessoas, Enter = recentrar, Shift+Enter = ficha, `+`/`-`/`0` = zoom/ajuste; rato (arrastar, roda) e toque (deslocar, pinçar). Exportação SVG/PNG, impressão (também em várias páginas à escala 1:1).
4. **Parentesco**: escolha duas pessoas; o resultado indica o termo romeno, o grau canónico e civil e o percurso explicado.
5. **Qualidade dos dados**: execute as verificações, abra a pessoa a partir do relatório, procure duplicados e una com **Anular** disponível.
6. **Dados e exportação**: cifragem opcional com palavra-passe, opções de privacidade na exportação, GEDCOM, JSON, CSV, relatório imprimível, **Apagar tudo**.

## O que NÃO faz e limites

- Não sincroniza entre dispositivos e não tem cópia na nuvem: faça exportações periódicas.
- Os dados ficam no navegador (localStorage, com IndexedDB como reserva); a eliminação dos dados do site ou o modo privado podem removê-los.
- GEDCOM 5.5.1 UTF-8 para uso corrente; ANSEL/ANSI apenas de forma mínima, com aviso. GEDCOM 7 e ZIP/GEDZIP não são suportados. As etiquetas desconhecidas são preservadas na ida e volta, mas não são editáveis.
- Os calendários não gregorianos são guardados como texto e tratados de forma aproximada nas verificações.
- Os termos de parentesco estão apenas em romeno (a interface está traduzida, a terminologia não); os casos muito complexos (casamentos repetidos entre parentes) recebem uma descrição aproximada ou o percurso mais curto. Não constitui aconselhamento jurídico ou religioso.
- Os duplicados são sugestões; verifique antes de unir.
- Não há mapa (os locais são apenas uma lista, sem geocodificação).
- As fotografias são opcionais, redimensionadas para no máximo 400 px e guardadas como `data:` na árvore; muitas fotografias ocupam grande parte da quota do navegador.
- A palavra-passe de cifragem não é guardada: **palavra-passe perdida = dados perdidos**.

## Privacidade

Os dados de família são sensíveis. A aplicação funciona localmente e não envia nada: não tem servidor, contas, análise nem pedidos de rede (CSP com `connect-src 'none'`), e a faixa no topo di-lo. A árvore é guardada apenas no seu navegador, opcionalmente cifrada com AES-GCM 256 com uma chave derivada por PBKDF2-SHA256 (310 000 iterações, sal e IV aleatórios). As exportações (GEDCOM, JSON, CSV, relatório) ocultam por predefinição as pessoas vivas (ou removem-nas por completo; opcionalmente também as nascidas nos últimos N anos); uma exportação sem ocultação exige confirmação explícita. Uma pessoa é considerada viva se não tiver óbito registado e não tiver nascido há mais de 110 anos, a menos que seja marcada manualmente.

## Formatos suportados

- Importação: GEDCOM 5.5.1 (`.ged`, UTF-8 com ou sem BOM; ANSI/ANSEL mínimo), `.fff.json` (incluindo cifrado).
- Exportação: GEDCOM 5.5.1 UTF-8 (`CHAR UTF-8`, linhas ≤ 255 com CONC/CONT), `.fff.json` (opcionalmente cifrado), CSV (pessoas, famílias), relatório HTML imprimível, SVG, PNG.
- Etiquetas GEDCOM: INDI, FAM, NAME (GIVN/SURN/NPFX/NSFX/NICK), SEX, BIRT/DEAT/BURI/CHR/MARR/DIV/OCCU/RESI/EVEN com DATE/PLAC/NOTE/SOUR, HUSB/WIFE/CHIL/FAMC/FAMS, SOUR/REPO, OBJE, ASSO; o resto é preservado tal como está.
- Os ficheiros com problemas são importados na medida do possível, com um relatório de erros e avisos.

## Aspetos técnicos

Um único ficheiro `index.html`, sem bibliotecas externas, funciona offline a partir de `file://`. CSP rigorosa (`default-src 'none'`, script com hash SHA-256, sem `unsafe-eval`, sem manipuladores inline); `style-src 'unsafe-inline'` é necessário para os estilos inline dos diagramas SVG, e `img-src`/`worker-src` com `data:`/`blob:` para as fotografias e a exportação PNG. A análise do GEDCOM, a indexação, as verificações e os duplicados são executados por fatias de tempo (sem bloquear a interface); a lista de pessoas é virtualizada (testada com 10 000 pessoas). A calculadora de parentesco encontra os antepassados comuns mais próximos, deduz o grau (civil = soma dos graus, canónico = máximo) e aplica tabelas de termos romenos, com afinidade, padrinhos/afilhados e o percurso mais curto como último recurso.

Testes: `node tests/test.mjs` (Playwright/Chromium, rede bloqueada): arranque/CSP, ida e volta GEDCOM com ficheiros realistas (diacríticos, CONC/CONT, datas aproximadas, etiquetas desconhecidas, ficheiro com problemas), datas, parentesco, consistência/duplicados/fusão, ocultação de pessoas vivas, cifragem, 10 000 pessoas, diagramas/teclado/exportação, axe, excesso horizontal, temas.

## Terceiros

Não é utilizado código de terceiros.

## Traduções

A interface está disponível em ro, en, fr, it, es, pt, hu, de. As traduções fr/it/es/pt/hu/de são automáticas e não foram verificadas por falantes nativos.

## Licença

MIT — veja o ficheiro `LICENSE` na raiz do repositório.

## Histórico

- 1.0.0 — 2026-10-14: primeira versão.
