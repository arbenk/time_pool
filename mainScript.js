// --- 变量定义区域 ---
let projectsData = [];
let currentView = 'active'; 
let currentAdjustMethod = 'add';
// 读取精简模式状态
let isCompactMode = localStorage.getItem('isCompactMode') === 'true';

// 设置状态变量
let isAutoTheme = localStorage.getItem('isAutoTheme') === 'true';
let isDimmingEnabled = localStorage.getItem('isDimmingEnabled') !== 'false'; // 默认开启

// 自动主题检测定时器
let autoThemeInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化主题
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
    } else {
        document.body.classList.add('dark-mode');
    }

    // 2. 初始化设置状态到 UI
    const settingAutoTheme = document.getElementById('settingAutoTheme');
    const settingDimming = document.getElementById('settingDimming');
    if (settingAutoTheme) settingAutoTheme.checked = isAutoTheme;
    if (settingDimming) settingDimming.checked = isDimmingEnabled;
    
    updateCompactButtonText();

    // 3. 绑定主题按钮长按/点击逻辑
    initThemeButton();

    // 4. 初始化自动主题逻辑
    if (isAutoTheme) {
        initAutoTheme();
    }

    // 5. 启动应用
    fetchProjects();
    setInterval(updateDisplayTimes, 1000);

    // 6. 初始化拖拽排序 (SortableJS)
    const grid = document.getElementById('projectGrid');
    if (typeof Sortable !== 'undefined' && grid) {
        new Sortable(grid, {
            animation: 150,
            delay: 300,
            delayOnTouchOnly: false,
            touchStartThreshold: 5,
            chosenClass: "sortable-chosen",
            dragClass: "sortable-drag",
            onStart: function (evt) {
                if (currentView === 'recycle') return false;
            },
            onEnd: function (evt) {
                if (currentView === 'recycle') return;
                const itemEls = grid.children;
                let newOrder = [];
                for (let i = 0; i < itemEls.length; i++) {
                    const id = itemEls[i].getAttribute('data-id');
                    if(id) newOrder.push(id);
                }
                saveOrder(newOrder);
            }
        });
    }

    // 7. 【关键】静默调用备份插件
    triggerBackupPlugin();
});

// --- 功能函数区 ---

// 备份插件调用函数
function triggerBackupPlugin() {
    // 找到或创建底部小字容器
    let footer = document.getElementById('footerBackupInfo');
    if (!footer) {
        // 如果 HTML 里没写，JS 自动创建一个
        footer = document.createElement('div');
        footer.id = 'footerBackupInfo';
        footer.style.cssText = "text-align: center; color: var(--secondary-text); font-size: 0.75rem; margin-top: 30px; opacity: 0.6; padding-bottom: 20px;";
        document.getElementById('view-main').appendChild(footer); 
    }
    
    footer.innerText = '🛡️ 数据安全检查中...';

    // 异步请求，不阻塞页面
    fetch('back_up.php')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                footer.innerText = `🛡️ 上次备份: ${data.last_backup}`;
                if (data.triggered) {
                    // 如果刚刚触发了备份，提示一下
                    const toast = document.createElement('div');
                    toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: var(--accent-green); color: white; padding: 10px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999; font-size: 0.9rem;";
                    toast.innerText = "✅ 系统已自动完成月度数据库备份并发送邮件";
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 5000);
                }
            } else {
                footer.innerText = `⚠️ 备份服务: ${data.msg || '未知错误'}`;
            }
        })
        .catch(err => {
            console.warn('备份插件连接失败', err);
            footer.innerText = '⚠️ 无法连接备份服务';
        });
}

// 主题按钮的长按/点击处理
function initThemeButton() {
    const btn = document.getElementById('btnTheme');
    if (!btn) return;
    
    let pressTimer;
    let isLongPress = false;

    const startPress = (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            document.getElementById('settingsModal').style.display = 'flex';
        }, 600); 
    };

    const endPress = (e) => {
        clearTimeout(pressTimer);
        if (!isLongPress) {
            toggleTheme();
        }
    };

    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', endPress);
    btn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    btn.addEventListener('touchstart', (e) => { 
        startPress(e);
    });
    btn.addEventListener('touchend', endPress);
    btn.addEventListener('contextmenu', e => e.preventDefault());
}

// 切换自动主题开关
function toggleAutoTheme(checked) {
    isAutoTheme = checked;
    localStorage.setItem('isAutoTheme', isAutoTheme);
    if (isAutoTheme) {
        initAutoTheme();
    } else {
        if (autoThemeInterval) clearInterval(autoThemeInterval);
    }
}

// 切换暂停变暗开关
function toggleDimming(checked) {
    isDimmingEnabled = checked;
    localStorage.setItem('isDimmingEnabled', isDimmingEnabled);
    renderProjects(); 
}

// 初始化自动主题
function initAutoTheme() {
    checkAutoTheme();
    if (autoThemeInterval) clearInterval(autoThemeInterval);
    autoThemeInterval = setInterval(checkAutoTheme, 60000);
}

function checkAutoTheme() {
    if (!isAutoTheme) return;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const long = position.coords.longitude;
            applyThemeByLocation(lat, long);
        }, (error) => {
            applyThemeByTime();
        });
    } else {
        applyThemeByTime();
    }
}

function applyThemeByTime() {
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;
    setTheme(!isDay); 
}

function applyThemeByLocation(lat, lng) {
    const now = new Date();
    const hour = now.getHours();
    const isDay = hour >= 6 && hour < 18; 
    setTheme(!isDay);
}

function setTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleViewMode() {
    isCompactMode = !isCompactMode;
    localStorage.setItem('isCompactMode', isCompactMode);
    updateCompactButtonText();
    renderProjects(); 
}

function updateCompactButtonText() {
    const btn = document.getElementById('btnToggleView');
    if (btn) {
        btn.innerText = isCompactMode ? '🔼 展开显示' : '≡ 折叠显示';
    }
}

async function saveOrder(orderList) {
    const formData = new FormData();
    formData.append('action', 'update_order');
    orderList.forEach(id => {
        formData.append('order[]', id);
    });
    await fetch('api.php', { method: 'POST', body: formData });
}

function switchView(view) {
    currentView = view;
    document.getElementById('tabActive').classList.toggle('active', view === 'active');
    document.getElementById('tabRecycle').classList.toggle('active', view === 'recycle');
    document.getElementById('btnAddProject').style.display = view === 'active' ? 'inline-block' : 'none';
    document.getElementById('btnCleanAll').style.display = view === 'recycle' ? 'inline-block' : 'none';
    fetchProjects();
}

async function fetchProjects() {
    const formData = new FormData();
    formData.append('action', 'get_projects');
    formData.append('view', currentView);
    const res = await fetch('api.php', { method: 'POST', body: formData });
    projectsData = await res.json();
    renderProjects();
}

// 渲染卡片
function renderProjects() {
    const grid = document.getElementById('projectGrid');
    grid.innerHTML = '';

    if (projectsData.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--secondary-text); padding: 40px;">暂无项目</div>`;
        return;
    }

    projectsData.forEach(p => {
        let totalUsed = parseInt(p.used_time); 
        let currentSessionTime = 0; 
        if (p.is_running == 1) {
            const nowUnix = Math.floor(Date.now() / 1000);
            const diff = nowUnix - parseInt(p.last_start_time);
            const validDiff = diff > 0 ? diff : 0; 
            totalUsed += validDiff;
            currentSessionTime = validDiff; 
        }
        
        const pool = parseInt(p.time_pool);
        const remaining = pool - totalUsed;
        const percentRaw = pool > 0 ? Math.round((totalUsed / pool) * 100) : null;
        const percentForWidth = percentRaw === null ? 0 : Math.min(100, Math.max(0, percentRaw));
        let barBackground = 'linear-gradient(90deg, #60a5fa, #10b981)'; 
        if (percentRaw !== null && percentRaw > 100) {
            barBackground = 'linear-gradient(90deg, #f97316, #ef4444)';
        }

        const card = document.createElement('div');
        
        const isPaused = (currentView === 'active' && p.is_running == 0);
        const dimClass = (isPaused && isDimmingEnabled) ? 'paused dimmed' : '';
        
        card.className = `card ${currentView === 'recycle' ? 'deleted' : ''} ${isCompactMode ? 'compact' : ''} ${dimClass}`;
        card.setAttribute('data-id', p.id); 

       let statusHtml = '';
       if (currentView === 'recycle') {
           statusHtml = `<span class="status-badge" style="color:var(--secondary-text)">Deleted</span>`;
       } else if (p.is_running == 1) {
           statusHtml = `
               <div style="text-align: right;">
                   <div id="disp-session-${p.id}" class="session-timer">${formatTime(currentSessionTime)}</div>
               </div>`;
       } else {
           statusHtml = `<span class="status-badge" style="color:var(--accent-red)">Paused</span>`;
       }
        
        if (isCompactMode) {
            // === 精简模式 ===
            let compactButtons = '';
            if (currentView === 'active') {
                compactButtons = `
                    <button class="btn Foldedbtn ${p.is_running == 1 ? 'btn-green' : 'btn-red'} btn-full" onclick="toggleTimer(${p.id}, ${p.is_running})">
                        ${p.is_running == 1 ? '进行中...' : '已暂停'}
                    </button>
                    <button class="btn btn-blue btn-full Foldedbtn" onclick="openAdjustModal(${p.id}, 'used')">改已用</button>
                    <button class="btn btn-purple btn-full Foldedbtn" onclick="openAdjustModal(${p.id}, 'pool')">修改池</button>
                    <button class="btn btn-yellow btn-full Foldedbtn" onclick="openEditModal(${p.id})">编辑</button>
                    <button class="btn btn-green btn-full Foldedbtn" onclick="openHistoryPage(${p.id}, '${p.name}')">历史</button>
                `;
            } else {
                compactButtons = `
                    <button class="btn btn-purple btn-full" onclick="restoreProject(${p.id})">♻️ 还原</button>
                    <button class="btn btn-red btn-full" onclick="cleanProject(${p.id})">❌ 删除</button>
                    <button class="btn btn-outline btn-full" onclick="openHistoryPage(${p.id}, '${p.name}')">历史</button>
                `;
            }

            card.innerHTML = `
                <div class="card-header" style="margin-bottom:0;">
                    <h2 class="project-name" style="margin:0;">${p.name}</h2>
                    ${statusHtml}
                </div>
                <div class="compact-time-grid">
                    <div class="compact-time-block">
                        <span class="compact-time-value" style="color:var(--accent-blue)">
                           已用<br><span id="disp-used-${p.id}" data-base="${p.used_time}" data-start="${p.last_start_time}" data-running="${p.is_running}">${formatTime(totalUsed)}</span>
                        </span>
                    </div>
                    <div class="compact-time-block">
                        <span class="compact-time-value" style="color: ${remaining < 0 ? '#ef4444' : '#10b981'}">
                            剩余<br>
                            <span id="disp-remain-${p.id}">${remaining < 0 ? '-' : ''}${formatTime(Math.abs(remaining))}</span>
                        </span>
                    </div>
                    <div class="compact-time-block">
                        <span class="compact-time-value pool" style="text-align:right">时间池<br>${formatTime(pool)}</span>
                    </div>
                </div>
                <div class="btn-group" style="margin-top:5px;">
                    ${compactButtons}
                </div>
            `;
        } else {
            // === 完整模式 ===
            let actionButtons = '';
            if (currentView === 'active') {
                actionButtons = `
                    <div class="btn-group">
                        <button class="btn ${p.is_running == 1 ? 'btn-green' : 'btn-red'} btn-full" onclick="toggleTimer(${p.id}, ${p.is_running})">
                            ${p.is_running == 1 ? '进行中...' : '已暂停 ▶'}
                        </button>
                        <button class="btn btn-blue btn-full" onclick="openAdjustModal(${p.id}, 'used')">修改已用</button>
                        <button class="btn btn-purple btn-full" onclick="openAdjustModal(${p.id}, 'pool')">修改池</button>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-yellow btn-full" onclick="openEditModal(${p.id})">编辑</button>
                        <button class="btn btn-green btn-full" onclick="openHistoryPage(${p.id}, '${p.name}')">历史</button>
                    </div>
                `;
            } else {
                actionButtons = `
                     <div class="btn-group">
                        <button class="btn btn-purple btn-full" onclick="restoreProject(${p.id})">♻️ 还原项目</button>
                        <button class="btn btn-red btn-full" onclick="cleanProject(${p.id})">❌ 彻底清理</button>
                    </div>
                    <div class="btn-group">
                         <button class="btn btn-outline btn-full" onclick="openHistoryPage(${p.id}, '${p.name}')">查看历史</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <h2 class="project-name">${p.name}</h2>
                        <div class="project-desc">${p.description}</div>
                    </div>
                    ${statusHtml}
                </div>
                <div class="time-rows">
                    <div class="time-row">
                        <span class="time-label">剩余时间</span>
                        <span class="time-value" id="disp-remain-${p.id}" style="color: ${remaining < 0 ? '#ef4444' : '#10b981'}">${remaining < 0 ? '-' : ''}${formatTime(Math.abs(remaining))}</span>
                    </div>
                    <div class="time-row">
                        <span class="time-label">已用时间</span>
                        <span class="time-value highlight" id="disp-used-${p.id}" data-base="${p.used_time}" data-start="${p.last_start_time}" data-running="${p.is_running}">${formatTime(totalUsed)}</span>
                    </div>
                    <div class="time-row">
                        <span class="time-label">时间池</span>
                        <span class="time-value pool">${formatTime(pool)}</span>
                    </div>
                    <div class="time-row">
                        <span class="time-label">进度</span>
                        <div style="flex:1; display:flex; align-items:center; gap:8px;">
                            <div class="progress" style="flex:1;">
                                <div class="progress-inner">
                                    <div class="progress-bar" id="disp-bar-${p.id}" style="width: ${percentForWidth}%; background: ${barBackground};"></div>
                                </div>
                            </div>
                            <span class="time-value progress-percent" id="disp-percent-${p.id}">${percentRaw === null ? '--' : (percentRaw > 100 ? percentRaw + '%' : percentRaw + '%')}</span>
                        </div>
                    </div>
                </div>
                ${actionButtons}
            `;
        }
        grid.appendChild(card);
    });
}

function updateDisplayTimes() {
    if (currentView === 'recycle') return; 
    const nowUnix = Math.floor(Date.now() / 1000);
    
    projectsData.forEach(p => {
        if (p.is_running == 1) {
            const usedEl = document.getElementById(`disp-used-${p.id}`);
            const remainEl = document.getElementById(`disp-remain-${p.id}`);
            const percentEl = document.getElementById(`disp-percent-${p.id}`);
            const barEl = document.getElementById(`disp-bar-${p.id}`);
            const sessionEl = document.getElementById(`disp-session-${p.id}`); 

            if (usedEl && remainEl) {
                const baseUsed = parseInt(p.used_time);
                const startTime = parseInt(p.last_start_time);
                const currentDiff = Math.max(0, nowUnix - startTime); 
                const totalUsed = baseUsed + currentDiff;
                const pool = parseInt(p.time_pool);
                const remaining = pool - totalUsed;
                
                if (sessionEl) {
                    sessionEl.innerText = formatTime(currentDiff);
                }
                usedEl.innerText = formatTime(totalUsed);
                
                let remainStr = formatTime(Math.abs(remaining));
                if (remaining < 0) {
                    remainEl.style.color = '#ef4444';
                    remainEl.innerText = '-' + remainStr;
                } else {
                    remainEl.style.color = '#10b981';
                    remainEl.innerText = remainStr;
                }
                
                if (percentEl && barEl) {
                    const percentRaw = pool > 0 ? Math.round((totalUsed / pool) * 100) : null;
                    const width = percentRaw === null ? 0 : Math.min(100, Math.max(0, percentRaw));
                    barEl.style.width = width + '%';
                    percentEl.innerText = percentRaw === null ? '--' : (percentRaw + '%');
                    
                    if (percentRaw !== null && percentRaw > 100) {
                        barEl.style.background = 'linear-gradient(90deg, #f97316, #ef4444)';
                    } else {
                        barEl.style.background = 'linear-gradient(90deg, #60a5fa, #10b981)';
                    }
                }
            }
        }
    });
}

// --- Action Functions ---

function toggleTimer(id, isRunning) {
    if (isRunning == 1) {
        document.getElementById('stopProjectId').value = id;
        document.getElementById('stopRemarkInput').value = ''; 
        document.getElementById('stopModal').style.display = 'flex';
        setTimeout(() => document.getElementById('stopRemarkInput').focus(), 100);
    } else {
        executeTimerRequest(id, 'start', null);
    }
}

async function submitStopTimer() {
    const id = document.getElementById('stopProjectId').value;
    const remark = document.getElementById('stopRemarkInput').value.trim();
    if (!remark) {
        alert('请填写本次工作内容的备注！');
        return;
    }
    await executeTimerRequest(id, 'stop', remark);
    closeModal('stopModal');
}

async function executeTimerRequest(id, type, remark) {
    const formData = new FormData();
    formData.append('action', 'toggle_timer');
    formData.append('id', id);
    formData.append('type', type);
    if (remark) {
        formData.append('remark', remark);
    }
    await fetch('api.php', { method: 'POST', body: formData });
    fetchProjects(); 
}

async function recycleProject() {
    if(!confirm('确定将此项目移入回收站吗？')) return;
    const id = document.getElementById('editProjectId').value;
    const formData = new FormData();
    formData.append('action', 'recycle_project');
    formData.append('id', id);
    await fetch('api.php', { method: 'POST', body: formData });
    closeModal('projectModal');
    fetchProjects();
}

async function restoreProject(id) {
    const formData = new FormData();
    formData.append('action', 'restore_project');
    formData.append('id', id);
    await fetch('api.php', { method: 'POST', body: formData });
    fetchProjects();
}

async function cleanProject(id) {
    if(!confirm('确定彻底删除该项目吗？所有历史记录也将被永久删除，无法恢复！')) return;
    const formData = new FormData();
    formData.append('action', 'clean_project');
    formData.append('id', id);
    await fetch('api.php', { method: 'POST', body: formData });
    fetchProjects();
}

async function cleanAllRecycle() {
    if(!confirm('危险操作：确定清空回收站吗？所有已删除项目将永久消失！')) return;
    const formData = new FormData();
    formData.append('action', 'clean_all_recycle');
    await fetch('api.php', { method: 'POST', body: formData });
    fetchProjects();
}

async function openHistoryPage(id, projectName) {
    document.getElementById('view-main').style.display = 'none';
    document.getElementById('view-history').style.display = 'block';
    
    document.getElementById('fullHistoryProjectId').value = id;
    document.getElementById('historyPageTitle').innerText = `${projectName}`;
    document.getElementById('fullHistoryList').innerHTML = '<div style="text-align:center; padding:20px;">加载中...</div>';

    window.scrollTo(0, 0);

    const formData = new FormData();
    formData.append('action', 'get_logs');
    formData.append('id', id);
    formData.append('view', currentView); 
    
    const res = await fetch('api.php', { method: 'POST', body: formData });
    const logs = await res.json();
    
    renderHistoryList(logs);
}

function backToMain() {
    document.getElementById('view-history').style.display = 'none';
    document.getElementById('view-main').style.display = 'block';
}

function renderHistoryList(logs) {
    const container = document.getElementById('fullHistoryList');
    container.innerHTML = '';
    
    if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--secondary-text); padding:40px;">暂无历史记录</div>';
        return;
    }

    const latestLogId = logs.length > 0 ? logs[0].id : 0;

    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const hasSnapshot = (log.snapshot_used !== null && log.snapshot_used !== undefined);
        let snapshotHtml = '';
        
        if (hasSnapshot) {
            const sUsed = parseInt(log.snapshot_used);
            const sPool = parseInt(log.snapshot_pool);
            const sRemain = sPool - sUsed;
            
            snapshotHtml = `
                <div class="detail-group snapshot-group">
                    <div class="time-tag" title="当时的剩余时间">
                        <span>剩余</span> 
                        <span style=" color: ${sRemain < 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">
                            ${sRemain < 0 ? '-' : ''}${formatTime(Math.abs(sRemain))}
                        </span>
                    </div>
                    <div class="time-tag" title="当时的已用时间">
                        <span>已用</span> 
                        <span style="color:var(--accent-blue)">${formatTime(sUsed)}</span>
                    </div>
                    <div class="time-tag" title="当时的时间池">
                        <span>总池</span> 
                        <span>${formatTime(sPool)}</span>
                    </div>
                </div>
            `;
        }

        let sessionHtml = ''; 
        let displayTitle = log.message;
        let icon = getLogIcon(log.action_type);
        let inlineTimeHtml = ''; 
        let dateDisplay = log.created_at; 

        if (log.action_type === 'stop') {
            try {
                const data = JSON.parse(log.message);
                displayTitle = data.remark ? data.remark : '完成计时';
                inlineTimeHtml = `<span class="inline-time-tag inline-time-blue">${data.duration}</span>`;

                if (data.start && data.end) {
                    const startDatePart = data.start.split(' ')[0]; 
                    const endDatePart = data.end.split(' ')[0];     
                    const startYear = startDatePart.substring(0, 4);
                    const endYear = endDatePart.substring(0, 4);
                    
                    let endTimeDisplay = '';

                    if (startDatePart === endDatePart) {
                        endTimeDisplay = data.end.split(' ')[1];
                    } else if (startYear === endYear) {
                        endTimeDisplay = data.end.substring(5);
                    } else {
                        endTimeDisplay = data.end;
                    }

                    dateDisplay = `${data.start} <span style="margin:0 4px; opacity:0.5; font-size:0.8em;">to</span> ${endTimeDisplay}`;
                }
            } catch (e) { }
        } else if (log.action_type === 'modify_used' || log.action_type === 'modify_pool') {
            try {
                const data = JSON.parse(log.message);
                displayTitle = data.remark ? data.remark : (log.action_type === 'modify_used' ? '修改已用' : '修改时间池');
                const isAdd = data.method === 'add';
                const sign = isAdd ? '+' : '-';
                const colorClass = isAdd ? 'inline-time-red' : 'inline-time-green';
                // const label = log.action_type === 'modify_used' ? '已用' : '池';
                inlineTimeHtml = `<span class="inline-time-tag ${colorClass}">${sign}${data.amount}</span>`;

                inlineTimeHtml = `<span class="inline-time-tag ${colorClass}">${label}${sign}${data.amount}</span>`;
            } catch (e) { 
                if (log.message.includes('<br>')) {
                    const parts = log.message.split('<br>');
                    const timePart = parts[0]; 
                    displayTitle = parts[1];   
                    let colorClass = 'inline-time-green';
                    if (timePart.includes('+')) colorClass = 'inline-time-red';
                    inlineTimeHtml = `<span class="${colorClass}">${timePart}</span>`;
                }
            }
        }

        let dividerHtml = '';
        if (snapshotHtml && sessionHtml) {
            dividerHtml = `<div class="detail-divider"></div>`;
        }

        let restoreBtn = '';
        if (hasSnapshot && log.id != latestLogId && currentView === 'active') {
            restoreBtn = `
                <button class="btn btn-outline" 
                    style="width: 130px; font-size: 0.75rem; padding: 4px 10px; margin-top: 8px; border: 1px solid var(--accent-red); color: var(--accent-red); background: transparent; cursor: pointer; border-radius: 4px;" 
                    onclick="rollbackLog(${log.id}, ${log.project_id})">
                    ⏪ 还原到此处
                </button>
            `;
        }

        let leftContent = `
            <div class="history-main" style="max-width: 65%;">
                <div class="history-top-section">
                    <div class="history-action" style="font-size:1.2rem;">${icon}</div>
                    ${inlineTimeHtml} 
                </div>
                <div class="history-action" style="font-size:0.9rem; margin-bottom: 4px; color:var(--text-color);">${displayTitle}</div>

                <div class="history-meta-group">
                    <div class="history-date">${dateDisplay}</div>
                    ${restoreBtn}
                </div>
            </div>
        `;
        
        let rightContent = '';
        if (snapshotHtml) {
            rightContent = `
                <div class="history-details">
                    ${snapshotHtml}
                </div>
            `;
        }

        div.innerHTML = leftContent + rightContent;
        
        if(log.action_type === 'stop') div.style.borderLeftColor = 'var(--accent-green)';
        else if(log.action_type === 'modify_pool') div.style.borderLeftColor = 'var(--accent-yellow)';
        else if(log.action_type === 'modify_used') div.style.borderLeftColor = 'var(--accent-yellow)';
        else if(log.action_type === 'create') div.style.borderLeftColor = 'var(--accent-blue)';
        else if(log.action_type === 'recycle') div.style.borderLeftColor = 'var(--accent-red)';
        else if(log.action_type === 'restore') div.style.borderLeftColor = 'var(--accent-purple)';

        container.appendChild(div);
    });
}

async function rollbackLog(logId, projectId) {
    if (!confirm('⚠️ 警告：确定要“时光倒流”到这个节点吗？\n\n1. 项目时间将完全恢复到记录时的状态。\n2. 此节点之后的所有历史记录将被永久删除！\n3. 如果项目正在计时，将强制停止。')) {
        return;
    }

    const formData = new FormData();
    formData.append('action', 'rollback_log');
    formData.append('log_id', logId);
    formData.append('project_id', projectId);

    const res = await fetch('api.php', { method: 'POST', body: formData });
    const result = await res.json();

    if (result.status === 'success') {
        const name = document.getElementById('historyPageTitle').innerText.replace('历史记录：', '');
        openHistoryPage(projectId, name);
    } else {
        alert(result.msg || '还原失败');
    }
}

async function clearHistoryFromPage() {
    if(!confirm('确定清空该项目的所有历史记录？此操作不可恢复。')) return;
    const id = document.getElementById('fullHistoryProjectId').value;
    const formData = new FormData();
    formData.append('action', 'clear_logs');
    formData.append('id', id);
    await fetch('api.php', { method: 'POST', body: formData });
    
    const name = document.getElementById('historyPageTitle').innerText.replace('历史记录：', '');
    openHistoryPage(id, name);
}

function openCreateModal() {
    document.getElementById('projectModalTitle').innerText = '添加项目';
    document.getElementById('editProjectId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pDesc').value = '';
    document.getElementById('poolInputs').style.display = 'block';
    document.getElementById('btnDeleteProject').style.display = 'none';
    document.getElementById('projectModal').style.display = 'flex';
}

function openEditModal(id) {
    const p = projectsData.find(x => x.id == id);
    document.getElementById('projectModalTitle').innerText = '编辑项目';
    document.getElementById('editProjectId').value = id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pDesc').value = p.description;
    document.getElementById('poolInputs').style.display = 'none';
    document.getElementById('btnDeleteProject').style.display = 'block'; 
    document.getElementById('projectModal').style.display = 'flex';
}

async function saveProject() {
    const id = document.getElementById('editProjectId').value;
    const name = document.getElementById('pName').value;
    const desc = document.getElementById('pDesc').value;
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', desc);

    if (!id) {
        formData.append('action', 'create_project');
        formData.append('pool_hours', document.getElementById('pHours').value);
        formData.append('pool_mins', document.getElementById('pMins').value);
    } else {
        formData.append('action', 'edit_info');
        formData.append('id', id);
    }

    await fetch('api.php', { method: 'POST', body: formData });
    closeModal('projectModal');
    fetchProjects();
}

function openAdjustModal(id, target) {
    document.getElementById('adjustProjectId').value = id;
    document.getElementById('adjustTarget').value = target;
    document.getElementById('adjRemark').value = '';
    setAdjustMethod('add');
    document.getElementById('adjustModal').style.display = 'flex';
}

function setAdjustMethod(method) {
    currentAdjustMethod = method;
    const btnAdd = document.getElementById('btnMethodAdd');
    const btnSub = document.getElementById('btnMethodSub');
    if (method === 'add') {
        btnAdd.className = 'btn btn-full btn-blue';
        btnSub.className = 'btn btn-full btn-outline';
    } else {
        btnAdd.className = 'btn btn-full btn-outline';
        btnSub.className = 'btn btn-full btn-blue';
    }
}

async function submitAdjust() {
    const id = document.getElementById('adjustProjectId').value;
    const target = document.getElementById('adjustTarget').value;
    const hours = document.getElementById('adjHours').value;
    const mins = document.getElementById('adjMins').value;
    const remark = document.getElementById('adjRemark').value;
    if (!remark) { alert('请填写修改备注'); return; }

    const formData = new FormData();
    formData.append('action', 'modify_time');
    formData.append('id', id);
    formData.append('target', target);
    formData.append('method', currentAdjustMethod);
    formData.append('hours', hours);
    formData.append('minutes', mins);
    formData.append('remark', remark);

    await fetch('api.php', { method: 'POST', body: formData });
    closeModal('adjustModal');
    fetchProjects();
}

function getLogIcon(type) {
    const map = {
        'create': '➕',
        'start': '▶️', 
        'stop': '📌',
        'modify_used': '🎬',
        'modify_pool': '⏳',
        'recycle': '🗑️',
        'restore': '♻️'
    };
    return map[type] || '📝';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}