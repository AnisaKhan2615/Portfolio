$(function () {
  let DATA = {};
  let ctx = null; // { section, id } currently being edited

  /* One config drives every modal form: [name, label, type, required] */
  const FORMS = {
    profile: { title: 'Your profile', fields: [
      ['full_name', 'Full name', 'text', 1], ['title', 'Professional title', 'text', 1],
      ['email', 'Email', 'text', 1], ['phone', 'Phone', 'text'], ['location', 'Location', 'text'],
      ['summary', 'About you', 'textarea'], ['linkedin', 'LinkedIn link', 'text'],
      ['github', 'GitHub link', 'text'], ['image', 'Profile photo', 'image']] },
    skills: { title: 'skill', fields: [
      ['name', 'Skill', 'text', 1], ['category', 'Category (e.g. Backend)', 'text'],
      ['level', 'Proficiency (0 to 100)', 'number']] },
    education: { title: 'education', fields: [
      ['degree', 'Degree', 'text', 1], ['institution', 'Institution', 'text', 1],
      ['start_year', 'Start year', 'text'], ['end_year', 'End year', 'text'],
      ['description', 'Details', 'textarea']] },
    experience: { title: 'experience', fields: [
      ['role', 'Role', 'text', 1], ['company', 'Company', 'text', 1],
      ['start_date', 'Start (e.g. Jan 2023)', 'text'], ['end_date', 'End (leave blank if current)', 'text'],
      ['description', 'What you did', 'textarea']] },
    projects: { title: 'project', fields: [
      ['title', 'Project name', 'text', 1], ['description', 'Description', 'textarea'],
      ['tech_stack', 'Technologies (comma separated)', 'text'], ['project_url', 'Live link', 'text'],
      ['repo_url', 'Repository link', 'text'], ['image', 'Project image', 'image']] },
  };

  const esc = (s) => $('<div>').text(s ?? '').html();
  const initials = (n) => (n || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const actions = (s, id) => `<div class="row-actions">
      <button class="btn ghost sm" data-edit="${s}" data-id="${id}">Edit</button>
      <button class="btn ghost sm danger" data-del="${s}" data-id="${id}">Delete</button></div>`;
  const empty = (msg) => `<div class="empty">${msg}</div>`;

  function toast(msg, isErr) {
    $('#toast').text(msg).toggleClass('err', !!isErr).addClass('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => $('#toast').removeClass('show'), 2800);
  }

  /* ---------- Render ---------- */
  function render() {
    const p = DATA.profile;
    if (p) {
      document.title = `${p.full_name} | ${p.title}`;
      const btn = (label, href, cls) => href ? `<a class="btn ${cls || ''}" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>` : '';
      $('#brand').html(`<b>${esc(initials(p.full_name))}</b>${esc(p.full_name)}`);
      $('#hero-text').html(`
        <span class="eyebrow">${esc(p.title)}</span>
        <h1>${esc(p.full_name)}</h1>
        <p class="lead">${esc(p.summary || 'Add a short introduction with Manage content, then Edit profile.')}</p>
        <div class="cta">${btn('Email me', 'mailto:' + p.email, 'primary')}${btn('GitHub', p.github)}${btn('LinkedIn', p.linkedin)}</div>
        <ul class="meta">${p.location ? `<li>${esc(p.location)}</li>` : ''}${p.phone ? `<li>${esc(p.phone)}</li>` : ''}<li>${esc(p.email)}</li></ul>`);
      $('#hero-photo').html(p.image
        ? `<img class="avatar" src="${esc(p.image)}" alt="Photo of ${esc(p.full_name)}">`
        : `<div class="avatar" aria-hidden="true">${esc(initials(p.full_name))}</div>`);
      $('#foot').text(`© ${new Date().getFullYear()} ${p.full_name}. Built with Node.js, Express and MySQL.`);
    } else {
      $('#brand').html('<b>?</b>Portfolio');
      $('#hero-text').html('<span class="eyebrow">Welcome</span><h1>Your portfolio is empty</h1><p class="lead">Choose Manage content, then Edit profile, to add your details.</p>');
      $('#hero-photo').empty();
    }

    $('#stats').html([['Projects', DATA.projects.length], ['Skills', DATA.skills.length], ['Experience', DATA.experience.length], ['Education', DATA.education.length]]
      .map(([l, n]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join(''));

    $('#experience-list').html(DATA.experience.length ? DATA.experience.map((e) => `
      <article class="entry"><div class="entry-top"><h3>${esc(e.role)}</h3>
      ${e.start_date ? `<span class="dates">${esc(e.start_date)} to ${esc(e.end_date || 'Present')}</span>` : ''}</div>
      <div class="org">${esc(e.company)}</div>
      <p>${esc(e.description)}</p>${actions('experience', e.id)}</article>`).join('') : empty('No experience added yet.'));

    $('#education-list').html(DATA.education.length ? DATA.education.map((e) => `
      <article class="entry"><div class="entry-top"><h3>${esc(e.degree)}</h3>
      ${e.start_year || e.end_year ? `<span class="dates">${esc(e.start_year || '')}${e.end_year ? ' to ' + esc(e.end_year) : ''}</span>` : ''}</div>
      <div class="org">${esc(e.institution)}</div>
      <p>${esc(e.description)}</p>${actions('education', e.id)}</article>`).join('') : empty('No education added yet.'));

    const groups = {};
    DATA.skills.forEach((s) => (groups[s.category || 'General'] = groups[s.category || 'General'] || []).push(s));
    $('#skills-list').html(DATA.skills.length ? Object.entries(groups).map(([g, items]) => `
      <div class="group"><h3>${esc(g)}</h3>${items.map((s) => `
        <div class="skill"><div class="top"><span>${esc(s.name)}</span>${s.level != null ? `<em>${s.level}%</em>` : ''}</div>
        ${s.level != null ? `<div class="bar"><i style="width:${s.level}%"></i></div>` : ''}${actions('skills', s.id)}</div>`).join('')}
      </div>`).join('') : empty('No skills added yet.'));

    $('#projects-list').html(DATA.projects.length ? DATA.projects.map((p) => `
      <article class="project">
        ${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="${esc(p.title)} preview">` : `<div class="thumb" aria-hidden="true">${esc(initials(p.title))}</div>`}
        <div class="body"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>
        <div class="tags">${(p.tech_stack || '').split(',').filter((t) => t.trim()).map((t) => `<span>${esc(t.trim())}</span>`).join('')}</div>
        <div class="links">${p.project_url ? `<a href="${esc(p.project_url)}" target="_blank" rel="noopener">Live site</a>` : ''}${p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener">Source code</a>` : ''}</div>
        ${actions('projects', p.id)}</div></article>`).join('') : empty('No projects added yet.'));
  }

  function load() {
    return $.getJSON('/api/portfolio').done((d) => { DATA = d; render(); })
      .fail(() => toast('Could not load portfolio. Is the server running?', true));
  }

  /* ---------- Modal form ---------- */
  function openForm(section, id) {
    ctx = { section, id };
    const cfg = FORMS[section];
    const row = section === 'profile' ? DATA.profile : DATA[section].find((r) => r.id === id);
    const isNew = !row;
    $('#dlgTitle').text(section === 'profile' ? cfg.title : `${isNew ? 'Add' : 'Edit'} ${cfg.title}`);
    $('#dlgNote').text(section === 'profile' && isNew ? 'Welcome. Add your details to publish your portfolio. You can change them any time.' : '');
    $('#fields').html(cfg.fields.map(([name, label, type, req]) => {
      const v = row ? row[name] ?? '' : '';
      const input = type === 'textarea' ? `<textarea id="f-${name}" name="${name}" rows="4">${esc(v)}</textarea>`
        : type === 'image' ? `${v ? `<img class="preview" src="${esc(v)}" alt="Current image">` : ''}<input id="f-${name}" name="image" type="file" accept="image/jpeg,image/png,image/webp"><div class="hint">JPG, PNG or WebP, up to 2 MB.${v ? ' Choose a file to replace the current image.' : ''}</div>`
        : `<input id="f-${name}" name="${name}" type="${type === 'number' ? 'number' : 'text'}" ${type === 'number' ? 'min="0" max="100"' : ''} value="${esc(v)}">`;
      return `<div class="field" data-name="${name}"><label for="f-${name}">${label}${req ? ' *' : ''}</label>${input}</div>`;
    }).join(''));
    $('#formError').prop('hidden', true);
    $('#save').text(section === 'profile' && isNew ? 'Publish portfolio' : 'Save changes');
    $('#modal').prop('hidden', false);
    $('#fields input,#fields textarea').first().trigger('focus');
  }
  const closeForm = () => $('#modal').prop('hidden', true);

  $('#form').on('submit', function (e) {
    e.preventDefault();
    const { section, id } = ctx;
    const url = section === 'profile' ? '/api/profile' : id ? `/api/${section}/${id}` : `/api/${section}`;
    $('.field').removeClass('bad').find('.msg').remove();
    $('#formError').prop('hidden', true);
    $('#save').prop('disabled', true);
    $.ajax({
      url, type: section === 'profile' || id ? 'PUT' : 'POST',
      data: new FormData(this), processData: false, contentType: false,
    }).done(() => load().done(() => { closeForm(); toast(section === 'profile' ? 'Profile saved' : id ? 'Changes saved' : 'Added to your portfolio'); }))
      .fail((x) => {
        const errs = (x.responseJSON && x.responseJSON.errors) || {};
        Object.entries(errs).forEach(([k, m]) => $(`.field[data-name="${k}"]`).addClass('bad').append(`<div class="msg">${esc(m)}</div>`));
        if (!Object.keys(errs).length) $('#formError').text((x.responseJSON && x.responseJSON.error) || 'Could not save. Try again.').prop('hidden', false);
        $('.field.bad input,.field.bad textarea').first().trigger('focus');
      }).always(() => $('#save').prop('disabled', false));
  });

  /* ---------- Events ---------- */
  $('#cancel').on('click', closeForm);
  $('#modal').on('mousedown', (e) => { if (e.target.id === 'modal') closeForm(); });
  $(document).on('keydown', (e) => { if (e.key === 'Escape') closeForm(); });

  $('#manageToggle').on('click', function () {
    const on = !$('body').hasClass('manage');
    $('body').toggleClass('manage', on);
    $(this).attr('aria-pressed', on).text(on ? 'Done managing' : 'Manage content');
  });
  $(document).on('click', '[data-edit-profile]', () => openForm('profile'));
  $(document).on('click', '[data-add]', function () { openForm($(this).data('add')); });
  $(document).on('click', '[data-edit]', function () { openForm($(this).data('edit'), Number($(this).data('id'))); });
  $(document).on('click', '[data-del]', function () {
    const s = $(this).data('del'), id = $(this).data('id');
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    $.ajax({ url: `/api/${s}/${id}`, type: 'DELETE' })
      .done(() => load().done(() => toast('Entry deleted')))
      .fail(() => toast('Could not delete entry', true));
  });

  $('#resetAll').on('click', function () {
    if (!confirm('This will delete your profile, photo and ALL entries. Start over?')) return;
    $.ajax({ url: '/api/reset', type: 'DELETE' })
      .done(() => load().done(() => { toast('Portfolio reset'); openForm('profile'); }))
      .fail(() => toast('Could not reset. Try again.', true));
  });

  /* First visit: no profile yet, so ask for it */
  load().done(() => { if (!DATA.profile) openForm('profile'); });
});
