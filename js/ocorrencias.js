// COLE AQUI A SUA URL DO APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbyGvBbmspX6HpqarZCqhsGt0If4y4n86wMVLUT31rXJtr-KDwhISkJvhZXuKvMz9DhwNg/exec"; 

let dadosSessao = null;
let cacheOcorrencias = [];

function obterDataHoraAtualLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
}

// Converte string DD/MM/AAAA para objeto Date
function converterParaData(dataStr) {
  if (!dataStr) return new Date(0);
  const partes = dataStr.split('/');
  if (partes.length === 3) {
    return new Date(partes[2], partes[1] - 1, partes[0]);
  }
  return new Date(dataStr);
}

// Ordena a lista do mais recente para o mais antigo
function ordenarHistorico(listaOcorrencias) {
  return [...listaOcorrencias].sort((a, b) => {
    // Tenta pegar a data curta (DD/MM/AAAA) ou extrai de data_hora
    const dtStrA = a.data_curta || (a.data_hora ? a.data_hora.split(',')[0].trim() : '');
    const dtStrB = b.data_curta || (b.data_hora ? b.data_hora.split(',')[0].trim() : '');

    const dataA = converterParaData(dtStrA);
    const dataB = converterParaData(dtStrB);

    // Comparação de datas (Decrescente)
    if (dataB.getTime() !== dataA.getTime()) {
      return dataB.getTime() - dataA.getTime();
    }

    // Se for o mesmo dia, ordena pelo timestamp de cadastro no servidor
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });
}

function formatarDataParaEnvio(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, '0');
  const minutos = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano}, ${horas}:${minutos}`;
}

function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  el.innerText = texto;
  el.className = 'msg ' + tipo;
}

function limparMsg(id) {
  const el = document.getElementById(id);
  el.innerText = '';
  el.className = 'msg';
}

function abrirModal(titulo, texto, acoesHtml = null) {
  document.getElementById('modal-titulo').innerText = titulo;
  document.getElementById('modal-texto').innerHTML = texto;
  const divAcoes = document.getElementById('modal-acoes');
  if (acoesHtml) {
    divAcoes.innerHTML = acoesHtml;
  } else {
    divAcoes.innerHTML = '<button type="button" onclick="fecharModal()">OK</button>';
  }
  document.getElementById('modal').classList.add('active');
}

function fecharModal() {
  document.getElementById('modal').classList.remove('active');
}

async function fazerLogin() {
  const mat = document.getElementById('matricula').value.trim();
  if (!mat) return;

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerText = 'Buscando...';
  limparMsg('login-msg');

  try {
    const resp = await fetch(`${API_URL}?action=validarMatricula&matricula=${encodeURIComponent(mat)}`, {
      method: 'GET',
      redirect: 'follow'
    });
    const res = await resp.json();
    btn.disabled = false;
    btn.innerText = 'Entrar';

    if (res.sucesso) {
      dadosSessao = res;
      iniciarMain();
    } else {
      mostrarMsg('login-msg', res.mensagem, 'error');
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerText = 'Entrar';
    mostrarMsg('login-msg', 'Erro de conexão com o servidor.', 'error');
  }
}

function iniciarMain() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  document.getElementById('prof-nome').innerText = dadosSessao.professor;
  
  const selectTurma = document.getElementById('turma');
  selectTurma.innerHTML = '<option value="">Selecione a Turma...</option>';
  dadosSessao.turmas.sort().forEach(t => {
    selectTurma.innerHTML += `<option value="${t}">${t}</option>`;
  });

  alternarAba('nova');
}

function alternarAba(aba) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

  if (aba === 'nova') {
    document.getElementById('btn-tab-nova').classList.add('active');
    document.getElementById('tab-nova').style.display = 'block';
    document.getElementById('edit-id').value = '';
    document.getElementById('btn-salvar').innerText = 'Registrar Ocorrência';
    document.getElementById('data_hora').value = obterDataHoraAtualLocal();
  } else if (aba === 'hoje') {
    document.getElementById('btn-tab-hoje').classList.add('active');
    document.getElementById('tab-hoje').style.display = 'block';
    carregarOcorrenciasHoje();
  } else if (aba === 'historico') {
    document.getElementById('btn-tab-historico').classList.add('active');
    document.getElementById('tab-historico').style.display = 'block';
    carregarHistoricoCompleto();
  }
}

async function carregarOcorrenciasHoje() {
  const div = document.getElementById('lista-hoje');
  div.innerHTML = 'Carregando ocorrências de hoje...';

  try {
    const resp = await fetch(`${API_URL}?action=obterOcorrenciasDia&professor=${encodeURIComponent(dadosSessao.professor)}`, {
      method: 'GET',
      redirect: 'follow'
    });
    const res = await resp.json();

    if (res.sucesso && res.dados.length > 0) {
      cacheOcorrencias = res.dados;
      div.innerHTML = renderizarOcorrenciasAgrupadas(res.dados);
    } else {
      div.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma ocorrência registrada hoje.</p>';
    }
  } catch (e) {
    div.innerHTML = '<p style="color:var(--error);">Erro ao carregar ocorrências de hoje.</p>';
  }
}

async function carregarHistoricoCompleto() {
  const div = document.getElementById('lista-historico');
  div.innerHTML = 'Carregando histórico...';

  try {
    const resp = await fetch(`${API_URL}?action=obterHistoricoCompleto`, {
      method: 'GET',
      redirect: 'follow'
    });
    const res = await resp.json();

    if (res.sucesso && res.dados.length > 0) {
      cacheOcorrencias = res.dados;
      div.innerHTML = renderizarOcorrenciasAgrupadas(res.dados);
    } else {
      div.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhum registro encontrado no histórico.</p>';
    }
  } catch (e) {
    div.innerHTML = '<p style="color:var(--error);">Erro ao carregar histórico.</p>';
  }
}

function renderizarOcorrenciasAgrupadas(lista) {
  // 1. Ordena os registros do mais recente ao mais antigo
  const listaOrdenada = ordenarHistorico(lista);

  // 2. Agrupa mantendo a ordem correta
  let grupos = {};
  let ordemGrupos = [];

  listaOrdenada.forEach(item => {
    let dt = item.data_curta || (item.data_hora ? item.data_hora.split(',')[0].trim() : 'Outras Datas');
    if (!grupos[dt]) {
      grupos[dt] = [];
      ordemGrupos.push(dt);
    }
    grupos[dt].push(item);
  });

  let html = '';
  let profLogado = (dadosSessao && dadosSessao.professor) ? dadosSessao.professor.trim().toLowerCase() : '';

  // 3. Itera pelas datas respeitando a ordem cronológica decrescente
  ordemGrupos.forEach(dataGrupo => {
    html += `<div class="data-group-header">📅 Data: ${dataGrupo}</div>`;
    
    html += grupos[dataGrupo].map(item => {
      let profItem = String(item.professor || '').trim().toLowerCase();
      let eDono = (profItem === profLogado);

      // Identifica lançamento retroativo
      let dataEvento = item.data_curta || (item.data_hora ? item.data_hora.split(',')[0].trim() : '');
      let dataLancamento = item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR') : dataEvento;
      let isRetroativo = (dataLancamento !== '' && dataEvento !== '' && dataLancamento !== dataEvento);

      let badgeRetroativo = isRetroativo 
        ? `<span class="badge-retroativo" title="Registrado em ${dataLancamento}">🕒 Lançado em ${dataLancamento}</span>` 
        : '';

      return `
        <div class="ocorrencia-card">
          <div class="ocorrencia-header">
            <span>${item.aluno_nome}</span>
            <span style="color:#64b5f6;">Turma: ${item.turma}</span>
          </div>
          <div class="ocorrencia-meta">
            Horário: ${item.data_hora.split(',')[1] || item.data_hora} | Prof: ${item.professor} ${badgeRetroativo}
          </div>
          <div class="ocorrencia-tipo">⚠️ ${item.tipo}</div>
          ${item.observacao ? `<div class="ocorrencia-obs">Obs: ${item.observacao}</div>` : ''}
          <div class="card-actions">
            <button type="button" class="btn-action btn-detalhes" onclick="verDetalhes('${item.id}')">Detalhes</button>
            ${eDono ? `
              <button type="button" class="btn-action btn-editar" onclick="prepararEdicao('${item.id}')">Editar</button>
              <button type="button" class="btn-action btn-apagar" onclick="confirmarExclusao('${item.id}')">Apagar</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  });

  return html;
}

async function carregarDisciplinasEAlunos() {
  const turma = document.getElementById('turma').value;
  const selectMateria = document.getElementById('materia');
  const selectAluno = document.getElementById('aluno');

  if (!turma) {
    selectMateria.disabled = true;
    selectAluno.disabled = true;
    return;
  }

  selectMateria.innerHTML = '<option value="">Selecione a Matéria...</option>';
  const disciplinas = dadosSessao.disciplinasPorTurma[turma] || [];
  disciplinas.sort().forEach(d => {
    selectMateria.innerHTML += `<option value="${d}">${d}</option>`;
  });
  selectMateria.disabled = false;

  selectAluno.innerHTML = '<option value="">Carregando alunos...</option>';
  selectAluno.disabled = true;

  try {
    const resp = await fetch(`${API_URL}?action=obterAlunos&turma=${encodeURIComponent(turma)}`, {
      method: 'GET',
      redirect: 'follow'
    });
    const alunos = await resp.json();
    selectAluno.innerHTML = '<option value="">Selecione o Aluno...</option>';
    if (alunos.length === 0) {
      selectAluno.innerHTML = '<option value="">Nenhum aluno ativo nesta turma</option>';
    } else {
      alunos.forEach(a => {
        selectAluno.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
      });
      selectAluno.disabled = false;
    }
  } catch (e) {
    selectAluno.innerHTML = '<option value="">Erro ao carregar alunos</option>';
  }
}

async function enviarOcorrencia() {
  const editId = document.getElementById('edit-id').value;
  const dataHoraRaw = document.getElementById('data_hora').value;
  const turma = document.getElementById('turma').value;
  const materia = document.getElementById('materia').value;
  const aluno = document.getElementById('aluno').value;
  const observacao = document.getElementById('observacao').value.trim();

  const checkboxes = document.querySelectorAll('input[name="tipo"]:checked');
  let tipos = Array.from(checkboxes).map(cb => cb.value);

  if (tipos.length === 0) {
    mostrarMsg('main-msg', 'Selecione pelo menos um motivo.', 'error');
    return;
  }

  const btn = document.getElementById('btn-salvar');
  btn.disabled = true;
  btn.innerText = 'Salvando...';

  const formData = new URLSearchParams();
  formData.append('action', editId ? 'editar' : 'salvar');
  if (editId) formData.append('id', editId);
  formData.append('data_hora', formatarDataParaEnvio(dataHoraRaw));
  formData.append('professor', dadosSessao.professor);
  formData.append('turma', turma);
  formData.append('materia', materia);
  formData.append('aluno', aluno);
  formData.append('tipoOcorrencia', tipos.join(', '));
  formData.append('observacao', observacao);

  try {
    const resp = await fetch(API_URL, { method: 'POST', body: formData });
    const res = await resp.json();
    btn.disabled = false;

    if (res.sucesso) {
      document.getElementById('form-ocorrencia').reset();
      document.getElementById('edit-id').value = '';
      
      abrirModal(
        'Sucesso!', 
        editId ? 'Ocorrência atualizada com sucesso!' : 'Ocorrência registrada e salva com sucesso!'
      );

      alternarAba('hoje');
    } else {
      abrirModal('Aviso', res.mensagem || 'Não foi possível salvar.');
    }
  } catch (e) {
    btn.disabled = false;
    abrirModal('Sucesso!', 'Ocorrência enviada com sucesso!');
    document.getElementById('form-ocorrencia').reset();
    alternarAba('hoje');
  }
}

function verDetalhes(id) {
  const item = cacheOcorrencias.find(o => String(o.id) === String(id));
  if (!item) return;

  let html = `
    <div style="text-align: left; font-size: 0.88rem; line-height: 1.6;">
      <p><strong>Data/Hora:</strong> ${item.data_hora}</p>
      <p><strong>Professor:</strong> ${item.professor}</p>
      <p><strong>Turma:</strong> ${item.turma}</p>
      <p><strong>Aluno:</strong> ${item.aluno_nome}</p>
      <p><strong>Disciplina:</strong> ${item.materia || '---'}</p>
      <p><strong>Motivo:</strong> ${item.tipo}</p>
      <p><strong>Observação:</strong> ${item.observacao || 'Nenhuma'}</p>
    </div>
  `;
  abrirModal('Detalhes da Ocorrência', html);
}

function prepararEdicao(id) {
  const item = cacheOcorrencias.find(o => String(o.id) === String(id));
  if (!item) return;

  alternarAba('nova');
  document.getElementById('edit-id').value = item.id;
  document.getElementById('btn-salvar').innerText = 'Atualizar Ocorrência';

  document.getElementById('turma').value = item.turma;
  
  carregarDisciplinasEAlunos().then(() => {
    document.getElementById('materia').value = item.materia;
    document.getElementById('aluno').value = item.aluno_id;
  });

  document.getElementById('observacao').value = item.observacao || '';

  const tiposArr = item.tipo.split(',').map(s => s.trim());
  document.querySelectorAll('input[name="tipo"]').forEach(cb => {
    cb.checked = tiposArr.includes(cb.value);
  });
}

function confirmarExclusao(id) {
  const acoesHtml = `
    <button type="button" style="background:#444;" onclick="fecharModal()">Cancelar</button>
    <button type="button" style="background:var(--error);" onclick="executarExclusao('${id}')">Sim, Apagar</button>
  `;
  abrirModal('Excluir Ocorrência', 'Tem certeza de que deseja apagar esta ocorrência?', acoesHtml);
}

async function executarExclusao(id) {
  fecharModal();
  const formData = new URLSearchParams();
  formData.append('action', 'excluir');
  formData.append('id', id);
  formData.append('professor', dadosSessao.professor);

  try {
    const resp = await fetch(API_URL, { method: 'POST', body: formData });
    const res = await resp.json();
    if (res.sucesso) {
      abrirModal('Excluído', 'Ocorrência removida com sucesso!');
      carregarOcorrenciasHoje();
      carregarHistoricoCompleto();
    } else {
      abrirModal('Aviso', res.mensagem);
    }
  } catch (e) {
    abrirModal('Erro', 'Não foi possível excluir a ocorrência.');
  }
}

function sair() {
  dadosSessao = null;
  document.getElementById('form-ocorrencia').reset();
  limparMsg('login-msg');
  limparMsg('main-msg');
  document.getElementById('screen-main').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
}