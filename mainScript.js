// --- 变量定义区域 ---
let projectsData = [];
let currentView = 'active'; 
let currentAdjustMethod = 'add';
// 【新增】读取精简模式状态
let isCompactMode = localStorage.getItem('isCompactMode') === 'true';

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化主题
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
    } else {
        document.body.classList.add('dark-mode');
    }

    // 【新增】初始化折叠按钮文字
    updateCompactButtonText();

    // 2. 启动应用
    fetchProjects();
    setInterval(updateDisplayTimes, 1000);

    // ... (SortableJS 初始化代码保持不变，请保留) ...
    const grid = document.getElementById('projectGrid');
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
});

// --- 【新增】切换视图模式函数 ---
function toggleViewMode() {
    isCompactMode = !isCompactMode;
    localStorage.setItem('isCompactMode', isCompactMode);
    updateCompactButtonText();
    renderProjects(); // 重新渲染列表
}

function updateCompactButtonText() {
    const btn = document.getElementById('btnToggleView');
    if (btn) {
        btn.innerText = isCompactMode ? '🔼 展开显示' : '≡ 折叠显示';
    }
}

// --- 【新增】保存排序函数 ---
async function saveOrder(orderList) {
    const formData = new FormData();
    formData.append('action', 'update_order');
        // 将数组作为多个值传递，或 JSON 字符串。
        // PHP 接收数组比较方便的方式是利用 name[] 格式，或者直接在前端多次 append
    orderList.forEach(id => {
        formData.append('order[]', id);
    });

    await fetch('api.php', { method: 'POST', body: formData });
}

// 切换主题并保存
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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
// --- 【核心修改】渲染卡片函数 ---
function renderProjects() {
    const grid = document.getElementById('projectGrid');
    grid.innerHTML = '';

    if (projectsData.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--secondary-text); padding: 40px;">暂无项目</div>`;
        return;
    }

    projectsData.forEach(p => {
        // 1. 计算时间数据
        let totalUsed = parseInt(p.used_time); 
        // 新增：初始化本次运行时长
        let currentSessionTime = 0; 
        if (p.is_running == 1) {
            const nowUnix = Math.floor(Date.now() / 1000);
            const diff = nowUnix - parseInt(p.last_start_time);
            const validDiff = diff > 0 ? diff : 0; // 修改：提取时长变量
            totalUsed += validDiff;
            currentSessionTime = validDiff; // 新增：记录本次时长
        }
        
        const pool = parseInt(p.time_pool);
        const remaining = pool - totalUsed;
        
        // 计算百分比和颜色
        const percentRaw = pool > 0 ? Math.round((totalUsed / pool) * 100) : null;
        const percentForWidth = percentRaw === null ? 0 : Math.min(100, Math.max(0, percentRaw));
        let barBackground = 'linear-gradient(90deg, #60a5fa, #10b981)'; 
        if (percentRaw !== null && percentRaw > 100) {
            barBackground = 'linear-gradient(90deg, #f97316, #ef4444)';
        }

        // 创建卡片容器
        const card = document.createElement('div');
        
        // 【核心修改】判断是否需要添加 'paused' 类
        // 条件：在“我的项目”视图下 且 项目未运行 (is_running == 0)
        const isPaused = (currentView === 'active' && p.is_running == 0);

        // 拼接类名：
        // 1. deleted: 回收站样式  // 2. compact: 精简模式样式  // 3. paused: 新增的暂停滤镜样式
        card.className = `card ${currentView === 'recycle' ? 'deleted' : ''} ${isCompactMode ? 'compact' : ''} ${isPaused ? 'paused' : ''}`;
        
        card.setAttribute('data-id', p.id);

       // --- 新增：准备右上角状态 HTML (包含 Running 和 计时器) ---
       let statusHtml = '';
       if (currentView === 'recycle') {
           statusHtml = `<span class="status-badge" style="color:var(--secondary-text)">Deleted</span>`;
       } else if (p.is_running == 1) {
           // 正在运行：显示 Running + 计时器
           statusHtml = `
               <div style="text-align: right;">
                   <div id="disp-session-${p.id}" class="session-timer">${formatTime(currentSessionTime)}</div>
               </div>`;
       } else {
           statusHtml = `<span class="status-badge" style="color:var(--accent-red)">Paused</span>`;
       }
        // --- 分支：根据是否是精简模式，渲染不同的 HTML ---
        
        if (isCompactMode) {
            // ======================
            // 🅰️ 精简模式 HTML (高度变短，隐藏无关信息)
            // ======================
            
            // 按钮逻辑 (精简版：只保留核心按钮)
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
                // 回收站模式下，还是需要保留还原/删除
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
            // ======================
            // 🅱️ 完整模式 HTML (保持原有代码不变)
            // ======================
            
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
            const sessionEl = document.getElementById(`disp-session-${p.id}`); // 新增：获取计时器元素

            if (usedEl && remainEl) {
                const baseUsed = parseInt(p.used_time);
                const startTime = parseInt(p.last_start_time);
                const currentDiff = Math.max(0, nowUnix - startTime); // 这是本次运行时长
                const totalUsed = baseUsed + currentDiff;
                const pool = parseInt(p.time_pool);
                const remaining = pool - totalUsed;
                // 新增：更新右上角本次计时器
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

// --- Actions ---

function toggleTimer(id, isRunning) {
    if (isRunning == 1) {
        // 正在运行 -> 停止 (弹窗)
        document.getElementById('stopProjectId').value = id;
        document.getElementById('stopRemarkInput').value = ''; 
        document.getElementById('stopModal').style.display = 'flex';
        setTimeout(() => document.getElementById('stopRemarkInput').focus(), 100);
    } else {
        // 停止 -> 开始 (直接请求)
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

// --- SPA History Page Logic ---

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

// --- 渲染历史列表 (已更新：左右分栏布局) ---
// --- 渲染历史列表 (已更新：响应式分栏布局) ---
// --- 渲染历史列表 (样式重构：彩色行内时间 + 右侧精简) ---
// --- 渲染历史列表 (已更新：智能日期格式化) ---
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

        // --- 1. 准备数据模块 ---
        // --- 1. 准备快照数据 (Snapshot - 右侧) ---
        // A. Snapshot 数据 (剩余/已用/总池)
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
        
        // B. Session 数据 (时长/结束/开始)
        // --- 2. 解析消息 & 提取关键时间到左侧 ---
        let sessionHtml = ''; 
        let displayTitle = log.message;
        let icon = getLogIcon(log.action_type);
        let inlineTimeHtml = ''; 
        let dateDisplay = log.created_at; 

        // 【场景 A：停止计时】
        if (log.action_type === 'stop') {
            try {
                const data = JSON.parse(log.message);
                displayTitle = data.remark ? data.remark : '完成计时';
                
                // 左侧显示蓝色时长
                inlineTimeHtml = `<span class="inline-time-tag inline-time-blue">${data.duration}</span>`;

                // --- 【核心修改】智能日期格式化 ---
                if (data.start && data.end) {
                    const startDatePart = data.start.split(' ')[0]; // 获取 "YYYY-MM-DD"
                    const endDatePart = data.end.split(' ')[0];     // 获取 "YYYY-MM-DD"
                    const startYear = startDatePart.substring(0, 4);
                    const endYear = endDatePart.substring(0, 4);
                    
                    let endTimeDisplay = '';

                    if (startDatePart === endDatePart) {
                        // 1. 同一天：只显示时间 "HH:mm:ss"
                        endTimeDisplay = data.end.split(' ')[1];
                    } else if (startYear === endYear) {
                        // 2. 同一年不同天：去掉年份，显示 "MM-DD HH:mm:ss"
                        endTimeDisplay = data.end.substring(5);
                    } else {
                        // 3. 跨年：显示完整时间 "YYYY-MM-DD HH:mm:ss"
                        endTimeDisplay = data.end;
                    }

                    dateDisplay = `${data.start} <span style="margin:0 4px; opacity:0.5; font-size:0.8em;">to</span> ${endTimeDisplay}`;
                }

                // 右侧 sessionHtml 留空，因为信息已移至左侧
                sessionHtml = ''; 

            } catch (e) { /* 兼容旧文本数据 */ }
        } 
        
        // 【场景 B：修改时间】
        else if (log.action_type === 'modify_used' || log.action_type === 'modify_pool') {
            try {
                // 尝试解析 JSON
                const data = JSON.parse(log.message);
                displayTitle = data.remark ? data.remark : (log.action_type === 'modify_used' ? '修改已用' : '修改时间池');
                
                const isAdd = data.method === 'add';
                const sign = isAdd ? '+' : '-';
                const colorClass = isAdd ? 'inline-time-red' : 'inline-time-green';
                // const label = log.action_type === 'modify_used' ? '已用' : '池';
                inlineTimeHtml = `<span class="inline-time-tag ${colorClass}">${sign}${data.amount}</span>`;
                
            } catch (e) { 
                    // 兼容旧数据
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

        // --- 3. 组装 ---
        // C. 分割线 (只有两边都有数据时才显示)
        let dividerHtml = '';
        if (snapshotHtml && sessionHtml) {
            dividerHtml = `<div class="detail-divider"></div>`;
        }

        // --- 2. 生成还原按钮 ---
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
        
            // 边框颜色逻辑
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

    // --- Modals & Utils ---

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