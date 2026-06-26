/*
 ****************************************************
 *  Author: Armin Silatani
 *  Date: 2026-06-23
 *  Version: 0.0.0
 ****************************************************
 */

/* =========================== RAVLO CALENDAR APP ============================ */

/* :::::::::::::::::::::::::: SUPABASE CLIENT :::::::::::::::::::::::::: */
const SUPABASE_URL = 'https://vzqicidepdmraygulrey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kqRWgOmLISOE2EuLL1s8fw_WN6FJRTI';
const {
    createClient
} = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* :::::::::::::::::::::::::: GLOBAL STATE :::::::::::::::::::::::::: */
let currentLocationAddress = null;
let currentUser = null;
let currentUserRole = 'public';
let currentProfile = null;
let locationMap = null;
let locationMarker = null;
let currentLocationCoords = null;
let currentLocationName = '';
let isLocationActive = false;
let currentInvitees = [];
let recurrence = {
    type: 'none',
    interval: 1,
    days: [],
    smartInterval: 'weekly'
};

let viewMode = localStorage.getItem('ravlo-view-mode') || 'month';
if (viewMode === 'week') {
    localStorage.setItem('ravlo-view-mode', 'day');
}
let currentDate = new Date();
let events = [];
let eventType = 'event';
let selectedTagColor = '#f5f5f5';
let currentChecklistItems = [];
let selectedIcon = null;
let titlePickerActive = false;
let editingEventId = null;
window.__lastMonthYearText = '';

/* :::::::::::::::::::::::::: DOM REFERENCES :::::::::::::::::::::::::: */
const authOverlay = document.getElementById('auth-overlay');
const appContainer = document.getElementById('app-container');
const authError = document.getElementById('auth-error');
const eventDetailModal = document.getElementById('event-detail-modal');
const eventDetailTitle = document.getElementById('event-detail-title');
const eventDetailDate = document.getElementById('event-detail-date');
const eventDetailAllDay = document.getElementById('event-detail-all-day');
let currentDetailEventId = null;

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const addEventBtn = document.getElementById('sidebar-new-event');
const eventModal = document.getElementById('event-modal');
const closeModalBtns = document.querySelectorAll('#event-modal .close-modal');
const saveEventBtn = document.getElementById('save-event');
const eventTitleInput = document.getElementById('event-title');
const eventStartInput = document.getElementById('event-start');
const eventEndInput = document.getElementById('event-end');
const eventAllDayCheck = document.getElementById('event-all-day');
const viewTabsEl = document.getElementById('view-tabs');
const currentMonthYearBtn = document.getElementById('current-month-year-btn');

const eventDetailConfirm = document.getElementById('event-detail-confirm');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

const tabIndicator = document.createElement('div');
tabIndicator.className = 'indicator';
if (viewTabsEl) viewTabsEl.appendChild(tabIndicator);

// Gregorian picker DOM references
const gregPickerPopup = document.getElementById('greg-picker-popup');
const gregPickerTrigger = document.getElementById('greg-picker-trigger');
const gregTriggerText = document.getElementById('greg-trigger-text');
const gregDaysEl = document.getElementById('greg-days');
const gregPrevBtn = document.getElementById('greg-prev');
const gregNextBtn = document.getElementById('greg-next');
const gregHourInput = document.getElementById('greg-hour');
const gregMinuteInput = document.getElementById('greg-minute');
const gregConfirmBtn = document.getElementById('greg-confirm');
const gregDateRow = document.getElementById('greg-date-row');
const eventStartGreg = document.getElementById('event-start-greg');
const gregMonthBtn = document.getElementById('greg-month-btn');
const gregYearBtn = document.getElementById('greg-year-btn');
const gregMonthPopup = document.getElementById('greg-month-popup');
const gregYearPopup = document.getElementById('greg-year-popup');
const gregYearPanel = document.getElementById('greg-year-panel');

// Additional picker state
var gregState = {
    gy: 2026,
    gm: 0,
    selectedGd: null
};
var GREG_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var currentDetailEvent = null;
/* :::::::::::::::::::::::::: LAZY PIN ICON :::::::::::::::::::::::::: */
let accentPinIcon = null;

function getAccentPinIcon() {
    if (!accentPinIcon) {
        if (typeof L === 'undefined') return null;
        accentPinIcon = L.divIcon({
            className: 'custom-pin',
            html: `<svg width="30" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.372 0 0 5.372 0 12c0 7.028 12 24 12 24s12-16.972 12-24C24 5.372 18.628 0 12 0zm0 16a4 4 0 110-8 4 4 0 010 8z"
                      fill="currentColor" stroke="#fff" stroke-width="1.5"/>
            </svg>`,
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40]
        });
    }
    return accentPinIcon;
}

// =========================== REMOVE NOTIFICATIONS FOR EVENT ============================
async function removeNotificationsForEvent(eventId, userId) {
    try {
        const { error } = await sb
            .from('notifications')
            .delete()
            .eq('user_id', userId)
            .eq('event_id', eventId);
        if (error) {
            console.warn('Remove notifications error:', error);
        } else {
            console.log('Notifications removed for event: ' + eventId);
        }
    } catch (e) {
        console.warn('Remove notifications error:', e);
    }
}

// =========================== CHECK AND CREATE TODAY NOTIFICATIONS ============================
async function checkAndCreateTodayNotifications() {
    if (!currentUser) return;
    
    const today = new Date();
    const ty = today.getFullYear(),
        tm = today.getMonth(),
        td = today.getDate();
    
    const todayEvents = events.filter(ev => {
        if (!ev.start_date) return false;
        if (ev.status === 'done' || ev.status === 'completed') return false;
        
        const d = new Date(ev.start_date);
        if (d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td) {
            if (ev.recurrence_type !== 'none') {
                const dateStr = toLocalDateString(today);
                const isCompleted = ev.completed_occurrences && Array.isArray(ev.completed_occurrences)
                    ? ev.completed_occurrences.includes(dateStr)
                    : false;
                return !isCompleted;
            }
            return true;
        }
        return false;
    });
    
    for (const ev of todayEvents) {
        const { data: existing } = await sb
            .from('notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('event_id', ev.id)
            .limit(1);
            
        if (!existing || existing.length === 0) {
            await addNotificationToUser(
                currentUser.id,
                'event',
                '📅 Event Today',
                `${ev.title || 'Untitled'} is today!`,
                '#',
                ev.id
            );
        }
    }
}

/* =========================== UTILITY FUNCTIONS ============================ */

const DASHBOARD_URL = 'https://arminsilatani.github.io/dashboard/';

async function addNotificationToUser(userId, type, title, body, link, eventId = null) {
    try {
        const payload = {
            user_id: userId,
            type,
            title,
            body,
            link,
            is_read: false,
            created_at: new Date().toISOString()
        };
        if (eventId) payload.event_id = eventId;
        
        await sb.from('notifications').insert(payload);
        console.log('Notification added for event: ' + eventId);
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function toLocalDateString(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function isGregDatePast(gy, gm, gd) {
    const today = new Date();
    const todayGy = today.getFullYear();
    const todayGm = today.getMonth();
    const todayGd = today.getDate();
    if (gy < todayGy) return true;
    if (gy === todayGy && gm < todayGm) return true;
    if (gy === todayGy && gm === todayGm && gd < todayGd) return true;
    return false;
}

function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
}

function animateMonthYearChange(newText) {
    const el = document.getElementById('current-month-year');
    if (!el) return;
    gsap.to(el, {
        opacity: 0,
        y: -8,
        duration: 0.15,
        onComplete: () => {
            el.textContent = newText;
            gsap.fromTo(el, {
                opacity: 0,
                y: 8
            }, {
                opacity: 1,
                y: 0,
                duration: 0.2,
                ease: 'power2.out'
            });
        }
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInviteCode() {
    return 'RAV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateInviteLinkForNewUser() {
    return `${DASHBOARD_URL}?ref=${currentUser.id}`;
}

const ICON_OPTIONS = [ /* ... unchanged, kept as is for brevity ... */ ];

/* ------------------------- INVITE LIST RENDERING ------------------------- */
function renderInviteModalList() {
    const list = document.getElementById('invite-list');
    if (!list) return;
    list.innerHTML = currentInvitees.map(name => `<li><span>${name}</span></li>`).join('');
}

/* ------------------------- CHECKLIST MODAL RENDERING ------------------------- */
let tempChecklistItems = [];

function renderChecklistModalItems() {
    const container = document.getElementById('checklist-modal-items');
    if (!container) return;
    container.innerHTML = tempChecklistItems.map((item, i) => `
        <div class="checklist-item">
            <input type="checkbox" class="neon-checkbox" ${item.done ? 'checked' : ''} data-index="${i}">
            <span contenteditable="true" class="checklist-text" data-index="${i}">${item.text}</span>
        </div>
    `).join('');

    container.querySelectorAll('.neon-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            const idx = parseInt(this.dataset.index);
            tempChecklistItems[idx].done = this.checked;
        });
    });
    container.querySelectorAll('.checklist-text').forEach(span => {
        span.addEventListener('input', function() {
            const idx = parseInt(this.dataset.index);
            tempChecklistItems[idx].text = this.textContent.trim();
        });
    });
    container.querySelectorAll('.remove-checklist-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            tempChecklistItems.splice(idx, 1);
            renderChecklistModalItems();
        });
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'ravlo-toast';
    const r = 10;
    const circumference = 2 * Math.PI * r;
    toast.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" class="toast-ring">
            <circle cx="12" cy="12" r="${r}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
            <circle cx="12" cy="12" r="${r}" fill="none" stroke="#fff" stroke-width="2"
                    stroke-dasharray="${circumference}" stroke-dashoffset="0"
                    stroke-linecap="round"
                    style="transition: stroke-dashoffset 4s linear;"/>
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        const ring = toast.querySelector('.toast-ring circle:last-child');
        if (ring) ring.style.strokeDashoffset = circumference;
    });
    setTimeout(() => toast.remove(), 4000);
}

/* =========================== HOLIDAYS ============================ */
const GREG_HOLIDAYS = {
    '01-01': "New Year's Day",
    '02-14': "Valentine's Day",
    '03-08': "Int'l Women's Day",
    '03-20': "Int'l Day of Happiness",
    '03-21': "Nowruz (Spring Equinox)",
    '04-01': "April Fools' Day",
    '04-22': "Earth Day",
    '05-01': "International Workers' Day",
    '06-05': "World Environment Day",
    '06-21': "World Music Day",
    '07-04': "US Independence Day",
    '08-12': "Int'l Youth Day",
    '09-21': "Int'l Day of Peace",
    '10-31': "Halloween",
    '11-11': "Veterans Day",
    '12-10': "Human Rights Day",
    '12-25': "Christmas Day",
    '12-31': "New Year's Eve"
};

function getGregHoliday(year, month, day) {
    return GREG_HOLIDAYS[pad(month + 1) + '-' + pad(day)] || null;
}

/* =========================== SVG ICONS ============================ */
const ICON_CALENDAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_SMILE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
const ICON_EDIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

/* =========================== PROFILE & AUTH ============================ */
async function buildCurrentProfile(user) {
    if (!user) return null;
    const {
        data: profileRow,
        error
    } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch warning:', error.message);
    }

    const md = user.user_metadata || {};
    const p = profileRow || {};

    return {
        id: user.id,
        first_name: p.first_name ?? md.first_name ?? md.given_name ?? '',
        last_name: p.last_name ?? md.last_name ?? md.family_name ?? '',
        photo_url: p.photo_url ?? md.photo_url ?? md.picture ?? '',
        username: p.username ?? md.username ?? '',
        role: p.role ?? md.role ?? 'recruit'
    };
}

/* =========================== SIDEBAR COMPONENT INTEGRATION ============================ */
let sidebarComponent = null;

function getSidebarComponent() {
    if (!sidebarComponent) {
        sidebarComponent = document.querySelector('sidebar-component');
        if (sidebarComponent) {
            // Listen to component's custom events
            sidebarComponent.addEventListener('login-request', () => {
                openModal(authOverlay);
                showStep('step-1');
                document.getElementById('auth-email').value = '';
                authEmail = '';
                document.getElementById('auth-error').textContent = '';
            });
            sidebarComponent.addEventListener('logout-request', () => {
                openModal(document.getElementById('logout-confirm-modal'));
            });
            sidebarComponent.addEventListener('session-restore-request', async () => {
                // Attempt to restore session when component asks (called in connectedCallback)
                try {
                    const { data: { session } } = await sb.auth.getSession();
                    if (session?.user) {
                        currentUser = session.user;
                        currentProfile = await buildCurrentProfile(currentUser);
                        currentUserRole = currentProfile?.role || 'recruit';
                        sidebarComponent.setUser(currentUser, currentProfile);
                        events = await fetchEvents();
                        sidebarComponent.setEvents(events);
                        renderCalendar();
                        await updateNotificationDot();
                    }
                } catch (e) {
                    console.warn('Session restore failed:', e);
                }
            });
        }
    }
    return sidebarComponent;
}

function syncSidebarComponent() {
    const comp = getSidebarComponent();
    if (!comp) return;
    if (currentUser) {
        comp.setUser(currentUser, currentProfile);
    } else {
        comp.clearUser();
    }
    comp.setEvents(events);
    updateNotificationDot(); // will set the dot on the component
}

async function updateNotificationDot() {
    const comp = getSidebarComponent();
    if (!comp) return;

    let hasNotifications = false;

    // 1. Check unread notifications in DB
    if (currentUser) {
        try {
            const { data, error } = await sb
                .from('notifications')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('is_read', false);
            if (!error && data && data.length > 0) {
                hasNotifications = true;
            }
        } catch (e) {
            console.warn('Could not fetch notifications:', e);
        }

        // 2. Check today's events (if no DB notifications)
        if (!hasNotifications) {
            const today = new Date();
            const ty = today.getFullYear(),
                tm = today.getMonth(),
                td = today.getDate();
            hasNotifications = events.some(ev => {
                if (!ev.start_date) return false;
                if (ev.status === 'done' || ev.status === 'completed') return false;
                const d = new Date(ev.start_date);
                if (d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td) {
                    if (ev.recurrence_type !== 'none') {
                        const dateStr = toLocalDateString(today);
                        const isCompleted = ev.completed_occurrences?.includes?.(dateStr);
                        return !isCompleted;
                    }
                    return true;
                }
                return false;
            });
        }
    }
    comp.setNotificationDot(hasNotifications);
}

/* =========================== MODAL HELPERS ============================ */
function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeModal(modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

function getLoaderHTML(type) {
    switch (type) {
        case 'dots':
            return `<div class="ravlo-loader" data-loader="dots"><span></span><span></span><span></span></div>`;
        case 'bar':
            return `<div class="ravlo-loader" data-loader="bar"><div></div></div>`;
        case 'grid':
            return `<div class="lds-grid">${Array(9).fill('<div></div>').join('')}</div>`;
        default:
            return `<div class="ravlo-loader" data-loader="spinner"></div>`;
    }
}

function showLoader(container, type = 'spinner') {
    let target;
    if (typeof container === 'string') {
        target = document.getElementById(container);
    } else if (container instanceof HTMLElement) {
        target = container;
    } else {
        target = document.body;
        const overlay = document.createElement('div');
        overlay.id = 'ravlo-global-loader';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
        overlay.innerHTML = getLoaderHTML(type);
        target.appendChild(overlay);
        return;
    }

    target.classList.add('ravlo-loading-container');
    target.style.position = target.style.position || 'relative';
    target.innerHTML = getLoaderHTML(type);
}

function hideLoader(container) {
    if (!container) {
        const globalLoader = document.getElementById('ravlo-global-loader');
        if (globalLoader) globalLoader.remove();
        return;
    }
    let target = typeof container === 'string' ? document.getElementById(container) : container;
    if (target) {
        target.classList.remove('ravlo-loading-container');
        target.style.position = '';
        const loader = target.querySelector('.ravlo-loader, .lds-grid');
        if (loader) loader.remove();
    }
}

function showGlobalLoader() {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.classList.remove('hidden');
}

function hideGlobalLoader() {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.classList.add('hidden');
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-modal-message');
    if (!modal || !msgEl) return;

    msgEl.textContent = message;
    openModal(modal);

    const yesBtn = document.getElementById('confirm-modal-yes');
    const noBtn = document.getElementById('confirm-modal-no');

    function cleanup() {
        closeModal(modal);
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
    }

    function handleYes() {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    }

    function handleNo() {
        cleanup();
    }

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            cleanup();
        }
    });
}

/* =========================== DATABASE HELPERS ============================ */
async function fetchEvents() {
    if (!currentUser) return [];
    const { data, error } = await sb
        .from('ravlo')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('start_date', { ascending: true });
    if (error) { console.warn('Fetch error:', error.message); return []; }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const ev of data) {
        if (ev.type === 'task' && 
            ev.recurrence_type === 'none' && 
            ev.status !== 'done' && 
            ev.status !== 'completed' &&
            ev.start_date) {
            
            const startDate = new Date(ev.start_date);
            startDate.setHours(0, 0, 0, 0);
            
            if (startDate < today) {
                const newStart = new Date(today);
                const oldHour = new Date(ev.start_date).getHours();
                const oldMinute = new Date(ev.start_date).getMinutes();
                newStart.setHours(oldHour, oldMinute, 0, 0);
                
                await updateEventInDB(ev.id, { 
                    start_date: newStart.toISOString()
                });
                
                ev.start_date = newStart.toISOString();
                console.log(`🔄 Task "${ev.title}" moved to today (was before today)`);
            }
        }
    }
    
    return data || [];
}

async function updateEventInDB(id, payload) {
    if (!currentUser) {
        showToast('Not logged in');
        return null;
    }
    const { error } = await sb.from('ravlo').update(payload).eq('id', id).eq('user_id', currentUser.id);
    if (error) {
        console.error('Update failed:', error);
        showToast('Update failed. Check console.');
        return null;
    }
    return true;
}

async function deleteEventFromDB(id) {
    if (!currentUser) {
        showToast('Not logged in');
        return;
    }
    const {
        error
    } = await sb.from('ravlo').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) showToast('Delete failed: ' + error.message);
    return !error;
}

async function saveEventToDB(payload) {
    if (!currentUser) {
        alert('Not logged in');
        return null;
    }
    payload.user_id = currentUser.id;
    const { data, error } = await sb.from('ravlo').insert([payload]).select();
    if (error) {
        alert('Save failed: ' + error.message);
        return null;
    }
    return data?.[0];
}

// =========================== SMART RECURRENCE HELPERS ============================
function getNextSmartDate(ev) {
    const interval = ev.recurrence_smart_interval || 'weekly';
    let intervalDays = interval === 'weekly' ? 7 : interval === '10day' ? 10 : 30;
    let searchWindow = interval === 'weekly' ? 2 : interval === '10day' ? 3 : 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodStart = new Date(today);
    periodStart.setDate(periodStart.getDate() + (intervalDays - searchWindow));
    const periodEnd = new Date(today);
    periodEnd.setDate(periodEnd.getDate() + intervalDays);

    const otherEvents = events.filter(e => e.id !== ev.id && e.recurrence_type !== 'smart');
    const slot = findBestSlot(periodStart, periodEnd, otherEvents);
    if (!slot) return null;
    const newDate = new Date(slot.date);
    newDate.setHours(slot.hour, slot.minute, 0, 0);
    return newDate;
}

async function createNextSmartTask(ev, newDate) {
    if (!currentUser) return;
    const payload = {
        title: ev.title || 'Untitled',
        description: ev.description || '',
        type: ev.type || 'task',
        all_day: ev.all_day || false,
        color: ev.color || '#f5f5f5',
        icon: ev.icon || null,
        checklist: ev.checklist || [],
        invitees: [],
        invitee_ids: [],
        location: ev.location || null,
        start_date: newDate.toISOString(),
        end_date: ev.end_date ? new Date(newDate.getTime() + (new Date(ev.end_date) - new Date(ev.start_date))).toISOString() : null,
        recurrence_type: 'smart',
        recurrence_interval: ev.recurrence_interval || 1,
        recurrence_days: [],
        recurrence_smart_interval: ev.recurrence_smart_interval || 'weekly',
        reminder_minutes: 0,
        status: 'pending',
        completed_occurrences: [],
        completed_timestamps: {},
        parent_event_id: null,
        invitation_status: null
    };

    const saved = await saveEventToDB(payload);
    if (saved) {
        events.push(saved);
        renderCalendar();
        updateNotificationDot();
        const dateStr = newDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = newDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        showToast(`Next task scheduled for ${dateStr} at ${timeStr}`);
    }
}

async function completeSmartTask(ev) {
    if (ev.status === 'done') return;
    ev.status = 'done';
    ev.completed_at = new Date().toISOString();

    try {
        await updateEventInDB(ev.id, { status: 'done', completed_at: ev.completed_at });
        if (currentUser) {
            await removeNotificationsForEvent(ev.id, currentUser.id);
        }

        const nextDate = getNextSmartDate(ev);
        if (nextDate) {
            await createNextSmartTask(ev, nextDate);
        }

        renderCalendar();
        updateNotificationDot();
        showToast('Task completed! Next task scheduled.');
    } catch (err) {
        console.error('Error completing smart task:', err);
        alert('Error completing task');
    }
}

// =========================== MOVE OVERDUE TASKS TO TODAY ============================
async function moveOverdueTasksToToday() {
    if (!currentUser) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        const { data: allTasks, error } = await sb
            .from('ravlo')
            .select('id, title, start_date, status, recurrence_type')
            .eq('user_id', currentUser.id)
            .eq('type', 'task')
            .neq('status', 'done')
            .neq('status', 'completed');

        if (error) throw error;
        if (!allTasks || allTasks.length === 0) return;

        let movedCount = 0;

        for (const task of allTasks) {
            const isRecurring = task.recurrence_type && task.recurrence_type !== 'none';
            if (isRecurring) continue;

            if (!task.start_date) continue;

            const startDate = new Date(task.start_date);
            startDate.setHours(0, 0, 0, 0);

            if (startDate < today) {
                const newStart = new Date(today);
                newStart.setHours(0, 0, 0, 0);

                await updateEventInDB(task.id, {
                    start_date: newStart.toISOString()
                });
                movedCount++;
                console.log(`Moved overdue task: "${task.title}" to today 00:00`);
            }
        }

        if (movedCount > 0) {
            console.log(`Moved ${movedCount} overdue tasks to today at 00:00`);
            events = await fetchEvents();
            renderCalendar();
        } else {
            console.log('No overdue non-recurring tasks found.');
        }
    } catch (e) {
        console.warn('Error moving overdue tasks:', e);
    }
}

/* =========================== AUTH FLOW ============================ */
async function showApp() {
    showGlobalLoader();
    closeModal(authOverlay);
    appContainer.style.display = 'block';

    if (currentUser) {
        events = await fetchEvents();
        await cleanupOldCompletions();
        await cleanupChecklistFromDescriptions();
        await moveOverdueTasksToToday();
        await checkAndCreateTodayNotifications();
    }
    renderCalendar();
    animateTabIndicator();
    syncSidebarComponent();  // replaces old renderTodayList/updateNotificationDot
    hideGlobalLoader();
}

async function logout() {
    showGlobalLoader();
    await sb.auth.signOut();
    currentUser = null;
    currentUserRole = 'public';
    currentProfile = null;
    events = [];
    renderCalendar();
    syncSidebarComponent();  // clears user in sidebar
    closeModal(eventModal);
    closeModal(eventDetailModal);
    hideGlobalLoader();
}

/* =========================== LEAFLET MAP HELPERS ============================ */
function isLeafletReady() {
    return typeof L !== 'undefined';
}

function initLocationMap(containerId = 'location-map') {
    if (!isLeafletReady()) return;
    if (locationMap) {
        locationMap.remove();
        locationMap = null;
    }
    const mapDiv = document.getElementById(containerId);
    if (!mapDiv) return;
    locationMap = L.map(containerId, {
        center: [48.85, 2.35],
        zoom: 13,
        attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(locationMap);

    locationMap.on('click', function(e) {
        if (locationMarker) locationMap.removeLayer(locationMarker);
        const icon = getAccentPinIcon();
        locationMarker = icon ? L.marker(e.latlng, {
            icon
        }).addTo(locationMap) : L.marker(e.latlng).addTo(locationMap);
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        const coordsInput = document.getElementById('location-modal-coords-input') || document.getElementById('location-coords-input');
        if (coordsInput) coordsInput.value = lat + ', ' + lng;
        const searchInput = document.getElementById('location-search-input');
        const infoEl = document.getElementById('selected-location-info');
        if (searchInput) searchInput.value = '';
        if (infoEl) infoEl.textContent = `Selected location: ${lat}, ${lng}`;
        currentLocationCoords = {
            lat: parseFloat(lat),
            lng: parseFloat(lng)
        };
        currentLocationName = '';
    });
}

function updateMapFromCoords(lat, lng) {
    if (!isLeafletReady()) return;
    if (!locationMap) initLocationMap();
    if (locationMarker) locationMap.removeLayer(locationMarker);
    const icon = getAccentPinIcon();
    locationMarker = icon ? L.marker([lat, lng], {
        icon
    }).addTo(locationMap) : L.marker([lat, lng]).addTo(locationMap);
    locationMap.setView([lat, lng], 15);
}

function parseCoordinates(str) {
    if (!str) return null;
    const parts = str.split(/[,\s]+/).map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return {
            lat: parts[0],
            lng: parts[1]
        };
    }
    return null;
}

/* =========================== RECURRENCE LOGIC ============================ */
function updateRecurrencePreview() {
    const preview = document.getElementById('recurrence-preview');
    if (!preview) return;

    if (recurrence.type === 'none') {
        preview.textContent = 'Does not repeat';
        return;
    }

    const labels = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
        custom: 'Custom'
    };

    let text = labels[recurrence.type] || recurrence.type;
    if (recurrence.interval > 1) text += ' (every ' + recurrence.interval + ')';

    if ((recurrence.type === 'weekly' || recurrence.type === 'custom') && recurrence.days.length > 0) {
        const dayMap = {
            0: 'Su',
            1: 'Mo',
            2: 'Tu',
            3: 'We',
            4: 'Th',
            5: 'Fr',
            6: 'Sa'
        };
        const dayNames = recurrence.days.map(d => dayMap[d]);
        text += ' on ' + dayNames.join(', ');
    }

    preview.textContent = text;
}

function openRecurrenceModal() {
    const modal = document.getElementById('recurrence-modal');
    if (!modal) return;

    const smartOption = document.getElementById('smart-option');
    if (smartOption) {
        smartOption.style.display = (eventType === 'task') ? 'block' : 'none';
    }

    document.getElementById('recurrence-select').value = recurrence.type;
    if (recurrence.type === 'smart') {
        const radio = document.querySelector(`input[name="smartInterval"][value="${recurrence.smartInterval}"]`);
        if (radio) radio.checked = true;
    }
    const intervalDisplay = document.getElementById('recurrence-interval-display');
    if (intervalDisplay) intervalDisplay.textContent = recurrence.interval;
    renderRecurrenceDays();
    updateRecurrenceModalUI();
    openModal(modal);
}

function updateRecurrenceModalUI() {
    const type = document.getElementById('recurrence-select').value;
    const intervalRow = document.getElementById('rec-interval-row');
    const daysRow = document.getElementById('rec-days-row');
    const intervalLabel = document.getElementById('rec-interval-label');
    const smartOptions = document.getElementById('smart-options');

    const showDays = (type === 'weekly' || type === 'custom');
    const showInterval = (type !== 'none' && type !== 'smart');
    const showSmart = (type === 'smart');

    intervalRow.style.display = showInterval ? 'flex' : 'none';
    daysRow.style.display = showDays ? 'block' : 'none';
    if (smartOptions) smartOptions.style.display = showSmart ? 'block' : 'none';

    if (showInterval && intervalLabel) {
        const map = {
            daily: 'day(s)',
            weekly: 'week(s)',
            monthly: 'month(s)',
            yearly: 'year(s)',
            custom: 'week(s)'
        };
        intervalLabel.textContent = map[type] || '';
    }

    if (showDays) renderRecurrenceDays();
}

function renderRecurrenceDays() {
    const container = document.getElementById('rec-days-container');
    if (!container) return;

    const daysOfWeek = [{
            label: 'Su',
            value: 0
        }, {
            label: 'Mo',
            value: 1
        }, {
            label: 'Tu',
            value: 2
        },
        {
            label: 'We',
            value: 3
        }, {
            label: 'Th',
            value: 4
        }, {
            label: 'Fr',
            value: 5
        }, {
            label: 'Sa',
            value: 6
        }
    ];

    container.innerHTML = '';
    daysOfWeek.forEach(day => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rec-day-btn';
        btn.textContent = day.label;
        if (recurrence.days.includes(day.value)) btn.classList.add('selected');
        btn.addEventListener('click', () => {
            btn.classList.toggle('selected');
            recurrence.days = Array.from(container.querySelectorAll('.rec-day-btn.selected'))
                .map(b => {
                    const idx = daysOfWeek.findIndex(d => d.label === b.textContent);
                    return daysOfWeek[idx].value;
                });
        });
        container.appendChild(btn);
    });
}

function findBestSlot(periodStart, periodEnd, events) {
    const dayEventCount = {};
    const hourEventCount = {};

    // مقداردهی اولیه
    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dayEventCount[dateStr] = 0;
        for (let h = 10; h < 18; h++) {
            hourEventCount[`${dateStr}-${h}`] = 0;
        }
    }

    // شمارش رویدادها (به جز رویدادهای smart)
    events.forEach(ev => {
        if (!ev.start_date) return;
        
        // رویدادهای smart را فقط یک بار در نظر می‌گیریم
        if (ev.recurrence_type === 'smart') {
            const start = new Date(ev.start_date);
            if (start >= periodStart && start <= periodEnd) {
                const dateStr = start.toISOString().split('T')[0];
                if (dayEventCount[dateStr] !== undefined) dayEventCount[dateStr]++;
                const hourKey = `${dateStr}-${start.getHours()}`;
                if (hourEventCount[hourKey] !== undefined) hourEventCount[hourKey]++;
            }
            return;
        }

        // برای رویدادهای غیر smart
        if (ev.recurrence_type !== 'none') {
            const recDates = getRecurrenceDates(ev, periodStart, periodEnd);
            recDates.forEach(rd => {
                const dateStr = rd.toISOString().split('T')[0];
                if (dayEventCount[dateStr] !== undefined) dayEventCount[dateStr]++;
                const hourKey = `${dateStr}-${rd.getHours()}`;
                if (hourEventCount[hourKey] !== undefined) hourEventCount[hourKey]++;
            });
        } else {
            const start = new Date(ev.start_date);
            if (start >= periodStart && start <= periodEnd) {
                const dateStr = start.toISOString().split('T')[0];
                if (dayEventCount[dateStr] !== undefined) dayEventCount[dateStr]++;
                const hourKey = `${dateStr}-${start.getHours()}`;
                if (hourEventCount[hourKey] !== undefined) hourEventCount[hourKey]++;
            }
        }
    });

    // انتخاب بهترین روز
    let minDayCount = Infinity;
    let bestDays = [];
    for (let dateStr in dayEventCount) {
        const count = dayEventCount[dateStr];
        if (count < minDayCount) {
            minDayCount = count;
            bestDays = [dateStr];
        } else if (count === minDayCount) {
            bestDays.push(dateStr);
        }
    }
    const chosenDay = bestDays[Math.floor(Math.random() * bestDays.length)];

    // انتخاب بهترین ساعت
    let minHourCount = Infinity;
    let bestHours = [];
    for (let h = 10; h < 18; h++) {
        const key = `${chosenDay}-${h}`;
        const count = hourEventCount[key];
        if (count < minHourCount) {
            minHourCount = count;
            bestHours = [h];
        } else if (count === minHourCount) {
            bestHours.push(h);
        }
    }
    const chosenHour = bestHours[Math.floor(Math.random() * bestHours.length)];

    return {
        date: new Date(chosenDay + 'T00:00:00'),
        hour: chosenHour,
        minute: 0
    };
}

function getRecurrenceDates(ev, fromDate, toDate) {
    if (!ev.start_date || ev.recurrence_type === 'none') return [];

    const start = new Date(ev.start_date);
    const type = ev.recurrence_type;

    // ── برای smart فقط تاریخ شروع را برگردان ──
    if (type === 'smart') {
        if (start >= fromDate && start <= toDate) {
            return [new Date(start)];
        }
        return [];
    }

    // ── برای بقیه انواع ──
    const interval = ev.recurrence_interval || 1;
    const days = ev.recurrence_days || [];
    const occurrences = [];

    const maxDate = new Date(start);
    maxDate.setFullYear(maxDate.getFullYear() + 2);

    let current = new Date(start);
    const end = toDate > maxDate ? maxDate : toDate;
    let iterations = 0;
    const MAX_ITERATIONS = 500;

    while (current <= end && iterations < MAX_ITERATIONS) {
        iterations++;
        if (current >= fromDate && current >= start) {
            occurrences.push(new Date(current));
        }

        switch (type) {
            case 'daily':
                current.setDate(current.getDate() + interval);
                break;
            case 'weekly':
                if (days.length > 0) {
                    let found = false;
                    for (let i = 0; i < 7; i++) {
                        current.setDate(current.getDate() + 1);
                        if (days.includes(current.getDay())) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) current.setDate(current.getDate() + 7 * interval);
                } else {
                    current.setDate(current.getDate() + 7 * interval);
                }
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + interval);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + interval);
                break;
            case 'custom':
                if (days.length > 0) {
                    let found = false;
                    for (let i = 0; i < 7; i++) {
                        current.setDate(current.getDate() + 1);
                        if (days.includes(current.getDay())) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) current.setDate(current.getDate() + 7 * interval);
                }
                break;
            default:
                return occurrences;
        }
    }
    return occurrences;
}

/* =========================== GREGORIAN PICKER ============================ */
function renderYearPanel(container, selectedYear, fromYear, toYear, persian, onSelect) {
    container.innerHTML = '';
    var now = new Date();
    var thisYear = persian ? toJalali(now.getFullYear(), now.getMonth(), now.getDate()).jy : now.getFullYear();
    for (var y = fromYear; y <= toYear; y++) {
        var btn = document.createElement('button');
        btn.className = 'py-btn';
        btn.textContent = persian ? toPersianNumerals(y) : y;
        if (y === selectedYear) btn.classList.add('selected');
        if (y === thisYear) btn.classList.add('current-year');
        (function(year) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                onSelect(year);
            });
        })(y);
        container.appendChild(btn);
    }
    setTimeout(() => {
        var s = container.querySelector('.selected');
        if (s) s.scrollIntoView({
            block: 'center'
        });
    }, 0);
}

function isToday(gy, gm, gd) {
    const today = new Date();
    return today.getFullYear() === gy && today.getMonth() === gm && today.getDate() === gd;
}

function setDefaultTimeForToday(prefix, gy, gm, gd, force = false) {
    const hourEl = document.getElementById(prefix + '-hour');
    const minEl = document.getElementById(prefix + '-minute');
    const endHourEl = document.getElementById(prefix + '-end-hour');
    const endMinEl = document.getElementById(prefix + '-end-minute');
    if (!hourEl || !minEl) return;

    if (!isToday(gy, gm, gd)) {
        if (!hourEl.value && !minEl.value) {
            hourEl.value = '09';
            minEl.value = '00';
            if (endHourEl) endHourEl.value = '10';
            if (endMinEl) endMinEl.value = '00';
        }
        return;
    }

    const now = new Date();
    let curHour = now.getHours();
    let curMin = now.getMinutes();
    let startMin = Math.ceil((curMin + 1) / 15) * 15;
    let startHour = curHour + 1;
    if (startMin >= 60) {
        startMin = 0;
        startHour++;
    }
    startHour = startHour % 24;

    if (force || !hourEl.value || !minEl.value ||
        parseInt(hourEl.value) < startHour ||
        (parseInt(hourEl.value) === startHour && parseInt(minEl.value) < startMin)) {
        hourEl.value = String(startHour).padStart(2, '0');
        minEl.value = String(startMin).padStart(2, '0');
        if (endHourEl) endHourEl.value = String((startHour + 1) % 24).padStart(2, '0');
        if (endMinEl) endMinEl.value = String(startMin).padStart(2, '0');
    }
}

function updateAllDayAndTimeRows() {
    const gregAllDayRow = document.getElementById('all-day-greg-row');
    const gregTimeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    const gregCheck = document.getElementById('event-all-day-greg');

    if (titlePickerActive) {
        if (gregAllDayRow) gregAllDayRow.style.display = 'none';
        if (gregTimeRow) gregTimeRow.style.display = 'none';
        return;
    }

    if (eventType === 'task') {
        if (gregAllDayRow) gregAllDayRow.style.display = 'none';
    } else {
        if (gregAllDayRow) gregAllDayRow.style.display = 'flex';
    }

    if (gregCheck && gregTimeRow) {
        gregTimeRow.style.display = gregCheck.checked ? 'none' : '';
    }
}

function syncTaskTimeVisibility() {
    const isTask = (eventType === 'task');
    const timeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    if (!timeRow) return;
    const groups = timeRow.querySelectorAll('.time-group');
    if (groups.length >= 2) {
        groups[1].style.display = isTask ? 'none' : '';
        const sep = timeRow.querySelector('.time-range-sep');
        if (sep) sep.style.display = isTask ? 'none' : '';
    }
}

function openGregPicker(gy, gm, gd) {
    var now = new Date();
    gregState.gy = gy !== undefined ? gy : now.getFullYear();
    gregState.gm = gm !== undefined ? gm : now.getMonth();
    gregState.selectedGd = gd || null;
    renderGregPicker();
    gregPickerPopup.classList.add('open');

    if (gregState.selectedGd !== null) {
        setDefaultTimeForToday('greg', gregState.gy, gregState.gm, gregState.selectedGd, true);
    } else {
        setDefaultTimeForToday('greg', now.getFullYear(), now.getMonth(), now.getDate(), true);
    }
    updateAllDayAndTimeRows();
    syncTaskTimeVisibility();
}

function renderGregPicker() {
    var gy = gregState.gy,
        gm = gregState.gm;
    gregMonthBtn.textContent = GREG_MONTH_NAMES[gm];
    gregYearBtn.textContent = gy;
    gregMonthPopup.classList.remove('open');
    gregYearPopup.classList.remove('open');
    var today = new Date(),
        daysInMonth = new Date(gy, gm + 1, 0).getDate(),
        firstDay = new Date(gy, gm, 1).getDay();
    gregDaysEl.innerHTML = '';
    var prevDays = new Date(gy, gm, 0).getDate();
    for (var i = 0; i < firstDay; i++) {
        var el = document.createElement('div');
        el.className = 'picker-day other';
        el.textContent = prevDays - firstDay + 1 + i;
        gregDaysEl.appendChild(el);
    }
    for (var d = 1; d <= daysInMonth; d++) {
        var el = document.createElement('div');
        el.className = 'picker-day';
        el.textContent = d;
        if (d === today.getDate() && gm === today.getMonth() && gy === today.getFullYear()) el.classList.add('today');
        if (d === gregState.selectedGd) el.classList.add('selected');
        if (isGregDatePast(gy, gm, d)) {
            el.classList.add('past');
        } else {
            (function(day) {
                el.addEventListener('click', function() {
                    gregState.selectedGd = day;
                    renderGregPicker();
                    setDefaultTimeForToday('greg', gregState.gy, gregState.gm, gregState.selectedGd, false);
                });
            })(d);
        }
        gregDaysEl.appendChild(el);
    }
}

function openGregMonthPopup() {
    if (gregMonthPopup.classList.contains('open')) {
        gregMonthPopup.classList.remove('open');
        return;
    }
    gregYearPopup.classList.remove('open');
    gregMonthPopup.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'month-grid';
    for (var i = 0; i < 12; i++) {
        var item = document.createElement('div');
        item.className = 'month-item' + (i === gregState.gm ? ' selected' : '');
        item.textContent = GREG_MONTH_NAMES[i];
        (function(idx) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                gregState.gm = idx;
                renderGregPicker();
            });
        })(i);
        grid.appendChild(item);
    }
    gregMonthPopup.appendChild(grid);
    gregMonthPopup.classList.add('open');
}

function openGregYearPopup() {
    if (gregYearPopup.classList.contains('open')) {
        gregYearPopup.classList.remove('open');
        return;
    }
    gregMonthPopup.classList.remove('open');
    gregYearPopup.classList.add('open');
    renderYearPanel(gregYearPanel, gregState.gy, 2000, 2040, false, function(y) {
        gregState.gy = y;
        renderGregPicker();
    });
}

/* ------------------------- RENDER DISPATCHER ------------------------- */
function syncViewTabsUI() {
    viewTabsEl.querySelectorAll('.view-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewMode));
}

function renderCalendar() {
    syncViewTabsUI();
    calendarGrid.className = 'calendar-grid';
    calendarGrid.removeAttribute('dir');
    calendarGrid.style.display = '';
    
    if (currentUser) {
        moveOverdueTasksToToday().then(() => {
            renderView();
        });
        return;
    }
    
    renderView();
}

function renderView() {
    if (viewMode === 'month') {
        renderGregorianMonth();
    } else if (viewMode === 'day') {
        renderDayView();
    } else if (viewMode === 'year') {
        renderYearView();
    }
    animateTabIndicator();
    if (window.__lastMonthYearText !== currentMonthYearEl.textContent) {
        animateMonthYearChange(currentMonthYearEl.textContent);
        window.__lastMonthYearText = currentMonthYearEl.textContent;
    }
    if (currentUser) {
        checkAndCreateTodayNotifications();
    }
    syncSidebarComponent();  // keeps today list & dot in sync
}

/* ------------------------- MONTH VIEW ------------------------- */
function renderGregorianMonth() {
    var year = currentDate.getFullYear(),
        month = currentDate.getMonth(),
        today = new Date();
    currentMonthYearEl.textContent = currentDate.toLocaleString('en-US', {
        month: 'long'
    }) + ' ' + year;
    calendarGrid.setAttribute('dir', 'ltr');
    calendarGrid.innerHTML = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
        var el = document.createElement('div');
        el.className = 'day-name';
        el.textContent = d;
        calendarGrid.appendChild(el);
    });
    var firstDay = new Date(year, month, 1).getDay(),
        daysInMonth = new Date(year, month + 1, 0).getDate(),
        daysInPrev = new Date(year, month, 0).getDate();
    for (var i = 0; i < firstDay; i++) calendarGrid.appendChild(makeGregCell(year, month - 1, daysInPrev - firstDay + 1 + i, true));
    for (var d = 1; d <= daysInMonth; d++) {
        var isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        calendarGrid.appendChild(makeGregCell(year, month, d, false, isToday));
    }
    var total = firstDay + daysInMonth,
        trailing = (7 - (total % 7)) % 7;
    for (var t = 1; t <= trailing; t++) calendarGrid.appendChild(makeGregCell(year, month + 1, t, true));
}

function makeGregCell(year, month, day, otherMonth, isToday) {
    var normDate = new Date(year, month, day),
        ny = normDate.getFullYear(),
        nm = normDate.getMonth(),
        nd = normDate.getDate();
    var cell = document.createElement('div');
    cell.className = 'day-cell' + (otherMonth ? ' other-month' : '') + (isToday ? ' today' : '');
    var numEl = document.createElement('span');
    numEl.className = 'day-number';
    numEl.textContent = day;
    cell.appendChild(numEl);
    var holiday = getGregHoliday(ny, nm, nd);
    if (holiday) {
        var hl = document.createElement('span');
        hl.className = 'holiday-label';
        hl.textContent = holiday;
        cell.appendChild(hl);
    }

    // فیلتر رویدادها با در نظر گرفتن وضعیت انجام‌شده
    var dayEvents = events.filter(ev => {
        if (!ev.start_date) return false;

        // رویدادهای غیرتکراری که کل آنها انجام شده → حذف
        if ((ev.status === 'done' || ev.status === 'completed') &&
            (ev.recurrence_type === 'none' || !ev.recurrence_type)) {
            return false;
        }

        // بررسی تاریخ شروع رویداد (غیرتکراری)
        var d = new Date(ev.start_date);
        if (d.getFullYear() === ny && d.getMonth() === nm && d.getDate() === nd) {
            if (ev.recurrence_type !== 'none') {
                // تکراری: اگر این تاریخ خاص انجام شده باشد، رد شود
                var dateStr = toLocalDateString(new Date(ny, nm, nd));
                if (ev.completed_occurrences && Array.isArray(ev.completed_occurrences) &&
                    ev.completed_occurrences.includes(dateStr)) {
                    return false;
                }
            }
            return true;
        }

        // بررسی رخدادهای تکراری
        if (ev.recurrence_type !== 'none') {
            const monthStart = new Date(ny, nm, 1);
            const monthEnd = new Date(ny, nm + 1, 0, 23, 59, 59);
            const recDates = getRecurrenceDates(ev, monthStart, monthEnd);
            return recDates.some(rd => {
                if (rd.getFullYear() === ny && rd.getMonth() === nm && rd.getDate() === nd) {
                    var dateStr = toLocalDateString(rd);
                    if (ev.completed_occurrences && Array.isArray(ev.completed_occurrences) &&
                        ev.completed_occurrences.includes(dateStr)) {
                        return false; // این رخداد انجام شده
                    }
                    return true;
                }
                return false;
            });
        }
        return false;
    });

    // ردیف نقطه‌های افقی
    const dotsRow = document.createElement('div');
    dotsRow.className = 'event-dots-row';

    dayEvents.forEach(ev => {
        var dot = document.createElement('div');
        dot.className = 'event-dot';
        if (ev.status === 'completed' || ev.status === 'done') {
            dot.classList.add('completed');
        } else {
            dot.style.backgroundColor = ev.color || 'var(--accent)';
        }
        if (ev.invitation_status === 'pending') {
            dot.classList.add('invited');
            dot.style.backgroundColor = ev.color || 'var(--accent)';
        }
        dotsRow.appendChild(dot);
    });

    if (dayEvents.length > 0) {
        cell.appendChild(dotsRow);
    }

    cell.addEventListener('click', () => {
        currentDate = new Date(ny, nm, nd);
        viewMode = 'day';
        syncViewTabsUI();
        renderCalendar();
    });
    return cell;
}

/* ------------------------- DAY VIEW ------------------------- */
function renderDayView() {
    var viewDate = new Date(currentDate);
    var vy = viewDate.getFullYear(),
        vm = viewDate.getMonth(),
        vd = viewDate.getDate();

    // ─── دریافت رویدادهای این روز ───
    var dayEvents = events.filter(ev => {
        if (!ev.start_date) return false;
        var d = new Date(ev.start_date);
        if (d.getFullYear() === vy && d.getMonth() === vm && d.getDate() === vd) return true;
        if (ev.recurrence_type !== 'none') {
            var dayStart = new Date(vy, vm, vd, 0, 0, 0);
            var dayEnd   = new Date(vy, vm, vd, 23, 59, 59);
            var recDates = getRecurrenceDates(ev, dayStart, dayEnd);
            return recDates.some(rd => rd.getFullYear() === vy && rd.getMonth() === vm && rd.getDate() === vd);
        }
        return false;
    });

    // ─── جدا کردن All‑Day ───
    var allDayEvents = dayEvents.filter(ev => ev.all_day === true);
    var timedEvents = dayEvents.filter(ev => ev.all_day !== true);

    // ─── محاسبه ارتفاع ساعات ───
    var occupiedHours = new Array(24).fill(false);
    timedEvents.forEach(ev => {
        var start = new Date(ev.start_date);
        var end = ev.end_date ? new Date(ev.end_date) : new Date(start.getTime() + 60 * 60 * 1000);
        var startMin = start.getHours() * 60 + start.getMinutes();
        var endMin   = end.getHours() * 60 + end.getMinutes();
        if (endMin <= startMin) endMin = startMin + 15;
        var sh = Math.floor(startMin / 60);
        var eh = Math.ceil(endMin / 60);
        for (var h = sh; h < eh && h < 24; h++) {
            occupiedHours[h] = true;
        }
    });

    var hourHeights = occupiedHours.map(occ => occ ? 60 : 20);
    var totalHeight = hourHeights.reduce((sum, h) => sum + h, 0);

    // ─── پاک کردن گرید ───
    calendarGrid.className = 'day-view-timeline';
    calendarGrid.innerHTML = '';

    // ─── 1) ردیف Overdue (فقط اگر امروز باشد) ───
    const todayCheck = new Date();
    if (vy === todayCheck.getFullYear() && vm === todayCheck.getMonth() && vd === todayCheck.getDate()) {
        var overdueOccurrences = [];
        if (currentUser) {
            var todayStart = new Date(vy, vm, vd, 0, 0, 0);
            var yesterdayEnd = new Date(todayStart.getTime() - 1000);

            events.forEach(ev => {
                if (ev.type !== 'task') return;
                if (!ev.start_date) return;
                if (ev.status === 'done' || ev.status === 'completed') return;
                if (!ev.recurrence_type || ev.recurrence_type === 'none') return;
                if (ev.recurrence_type === 'smart') return; // smart tasks handled separately

                var start = new Date(ev.start_date);
                var recDates = getRecurrenceDates(ev, start, yesterdayEnd);
                recDates.forEach(rd => {
                    var dateStr = toLocalDateString(rd);
                    var isCompleted = ev.completed_occurrences && Array.isArray(ev.completed_occurrences)
                        ? ev.completed_occurrences.includes(dateStr)
                        : false;
                    if (!isCompleted) {
                        overdueOccurrences.push({
                            ev: ev,
                            date: dateStr,
                            time: rd
                        });
                    }
                });
            });
        }

        if (overdueOccurrences.length > 0) {
            var overdueRow = document.createElement('div');
            overdueRow.className = 'all-day-events-row overdue-row';
            overdueRow.style.background = 'rgba(255,100,100,0.05)';
            overdueRow.style.borderBottom = '1px solid rgba(255,100,100,0.2)';
            var overdueLabel = document.createElement('span');
            overdueLabel.style.cssText = 'font-size:10px; color:#ff6b6b; text-transform:uppercase; margin-right:8px;';
            overdueLabel.textContent = 'Overdue';
            overdueRow.appendChild(overdueLabel);

            overdueOccurrences.forEach(item => {
                var capsule = document.createElement('span');
                capsule.className = 'all-day-capsule overdue-capsule';
                capsule.style.backgroundColor = item.ev.color || 'var(--accent)';
                capsule.style.color = '#0d0d0d';
                capsule.style.border = '1px solid ' + (item.ev.color || 'var(--accent)');

                if (item.ev.icon) {
                    var iconSpan = document.createElement('span');
                    iconSpan.className = 'all-day-capsule-icon';
                    iconSpan.innerHTML = item.ev.icon;
                    capsule.appendChild(iconSpan);
                }

                var titleSpan = document.createElement('span');
                titleSpan.className = 'all-day-capsule-title';
                titleSpan.textContent = (item.ev.title || 'Untitled') + ' (' + item.date + ')';
                capsule.appendChild(titleSpan);

                capsule.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openEventDetail(item.ev, new Date(item.date + 'T00:00:00'));
                });

                overdueRow.appendChild(capsule);
            });

            calendarGrid.appendChild(overdueRow);
        }
    }

    // ─── 2) ردیف رویدادهای تمام روز ───
    if (allDayEvents.length > 0) {
        var allDayRow = document.createElement('div');
        allDayRow.className = 'all-day-events-row';
        allDayEvents.forEach(ev => {
            var capsule = document.createElement('span');
            capsule.className = 'all-day-capsule';
            capsule.style.backgroundColor = ev.color || 'var(--accent)';
            capsule.style.color = '#fff';
            capsule.style.border = '1px solid ' + (ev.color || 'var(--accent)');

            if (ev.icon) {
                var iconSpan = document.createElement('span');
                iconSpan.className = 'all-day-capsule-icon';
                iconSpan.innerHTML = ev.icon;
                capsule.appendChild(iconSpan);
            }

            var titleSpan = document.createElement('span');
            titleSpan.className = 'all-day-capsule-title';
            titleSpan.textContent = ev.title || 'Untitled';
            capsule.appendChild(titleSpan);

            capsule.addEventListener('click', function(e) {
                e.stopPropagation();
                openEventDetail(ev, new Date(vy, vm, vd));
            });

            allDayRow.appendChild(capsule);
        });
        calendarGrid.appendChild(allDayRow);
    }

    // ─── 3) تایم‌لاین ───
    var timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'day-timeline-wrapper';

    var timeLabels = document.createElement('div');
    timeLabels.className = 'time-labels';
    for (var h = 0; h < 24; h++) {
        var label = document.createElement('div');
        label.className = 'time-label';
        label.style.height = hourHeights[h] + 'px';
        label.textContent = String(h).padStart(2, '0') + ':00';
        timeLabels.appendChild(label);
    }

    var slots = document.createElement('div');
    slots.className = 'time-slots';
    slots.style.height = totalHeight + 'px';

    timelineWrapper.appendChild(timeLabels);
    timelineWrapper.appendChild(slots);
    calendarGrid.appendChild(timelineWrapper);

    // ─── خطوط افقی ───
    var cumulativeTop = 0;
    for (var h = 0; h < 24; h++) {
        var lineEl = document.createElement('div');
        lineEl.style.position = 'absolute';
        lineEl.style.left = '0';
        lineEl.style.right = '0';
        lineEl.style.height = '1px';
        lineEl.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        lineEl.style.top = cumulativeTop + 'px';
        lineEl.style.zIndex = '0';
        lineEl.style.pointerEvents = 'none';
        slots.appendChild(lineEl);
        cumulativeTop += hourHeights[h];
    }

    // ─── رندر رویدادهای زمان‌دار ───
    requestAnimationFrame(function() {
        var eventsWithMinutes = timedEvents.map(ev => {
            var start = new Date(ev.start_date);
            var end = ev.end_date ? new Date(ev.end_date) : new Date(start.getTime() + 60 * 60 * 1000);
            return {
                ev,
                startMin: start.getHours() * 60 + start.getMinutes(),
                endMin: end.getHours() * 60 + end.getMinutes()
            };
        }).sort((a, b) => a.startMin - b.startMin);

        var lanes = [];
        eventsWithMinutes.forEach(item => {
            var laneIndex = -1;
            for (var i = 0; i < lanes.length; i++) {
                var lastEventInLane = lanes[i][lanes[i].length - 1];
                if (lastEventInLane.endMin <= item.startMin) {
                    laneIndex = i;
                    break;
                }
            }
            if (laneIndex === -1) {
                lanes.push([item]);
            } else {
                lanes[laneIndex].push(item);
            }
        });

        var laneCount = lanes.length;
        const SLOT_PADDING = 10;
        var slotsWidth = slots.clientWidth || 600;

        lanes.forEach((laneEvents, laneIndex) => {
            laneEvents.forEach(item => {
                var startMin = item.startMin;
                var endMin = item.endMin;
                if (endMin <= startMin) endMin = startMin + 15;

                // محاسبه top
                var topPx = 0;
                for (var h = 0; h < 24; h++) {
                    if (h < Math.floor(startMin / 60)) {
                        topPx += hourHeights[h];
                    } else if (h === Math.floor(startMin / 60)) {
                        topPx += (startMin % 60) / 60 * hourHeights[h];
                        break;
                    }
                }

                // محاسبه ارتفاع
                var heightPx = 0;
                var curMin = startMin;
                while (curMin < endMin && curMin < 24 * 60) {
                    var hourIdx = Math.floor(curMin / 60);
                    var minsLeft = 60 - (curMin % 60);
                    var minsToEnd = Math.min(endMin - curMin, minsLeft);
                    heightPx += (minsToEnd / 60) * hourHeights[hourIdx];
                    curMin += minsToEnd;
                }

                var gapPx = 15;
                var totalGap = gapPx * (laneCount - 1);
                var availableWidth = slotsWidth - 2 * SLOT_PADDING - totalGap;
                var laneWidthPx = availableWidth / laneCount;
                var leftPx = SLOT_PADDING + laneIndex * (laneWidthPx + gapPx);

                var evEl = document.createElement('div');
                evEl.className = 'time-slot-event';
                evEl.style.position = 'absolute';
                evEl.style.top = topPx + 'px';
                evEl.style.height = Math.max(heightPx, 28) + 'px';
                evEl.style.left = leftPx + 'px';
                evEl.style.width = laneWidthPx + 'px';
                evEl.style.borderRadius = '6px';
                evEl.style.padding = '6px 15px';
                evEl.style.fontSize = '12px';
                evEl.style.color = '#f5f5f5';
                evEl.style.overflow = 'hidden';
                evEl.style.boxSizing = 'border-box';
                evEl.style.cursor = 'pointer';
                evEl.style.zIndex = '2';
                evEl.style.transition = 'background 0.2s';

                // استایل
                if (item.ev.invitation_status === 'pending') {
                    evEl.classList.add('event-invited');
                    var borderColor = item.ev.color || 'var(--accent)';
                    evEl.style.border = '2px solid ' + borderColor;
                    evEl.style.backgroundColor = borderColor + '26';
                } else {
                    if (item.ev.status === 'completed' || item.ev.status === 'done') {
                        evEl.classList.add('event-completed');
                    }
                    if (item.ev.color) {
                        evEl.style.border = '2px solid ' + item.ev.color;
                        evEl.style.backgroundColor = item.ev.color + '26';
                    } else {
                        evEl.style.border = '2px solid var(--accent)';
                        evEl.style.backgroundColor = 'rgba(255,111,145,0.15)';
                    }
                }

                // عنوان
                var titleSpan = document.createElement('div');
                titleSpan.className = 'event-title';
                titleSpan.style.fontWeight = '400';
                titleSpan.style.whiteSpace = 'nowrap';
                titleSpan.style.overflow = 'hidden';
                titleSpan.style.textOverflow = 'ellipsis';
                titleSpan.style.color = '#1a1a1a';
                titleSpan.style.background = 'rgba(255,255,255,0.85)';
                titleSpan.style.display = 'inline-block';
                titleSpan.style.padding = '2px 6px';
                titleSpan.style.borderRadius = '4px';
                titleSpan.style.lineHeight = '1.3';

                if (item.ev.icon) {
                    var iconWrapper = document.createElement('span');
                    iconWrapper.className = 'event-icon';
                    iconWrapper.innerHTML = item.ev.icon;
                    titleSpan.appendChild(iconWrapper);
                    titleSpan.appendChild(document.createTextNode(' ' + (item.ev.title || 'Event')));
                } else {
                    titleSpan.textContent = item.ev.title || 'Event';
                }
                evEl.appendChild(titleSpan);

                // نشان دعوت
                if (item.ev.invitation_status === 'pending') {
                    var badge = document.createElement('span');
                    badge.className = 'invited-badge';
                    badge.style.position = 'absolute';
                    badge.style.top = '4px';
                    badge.style.right = '8px';
                    badge.style.background = '#666';
                    badge.style.color = 'white';
                    badge.style.fontSize = '10px';
                    badge.style.padding = '2px 6px';
                    badge.style.borderRadius = '8px';
                    badge.style.zIndex = '2';
                    badge.textContent = 'Invited';
                    evEl.appendChild(badge);
                }

                // ─── دکمه‌های اکشن ───
                var actionsDiv = document.createElement('div');
                actionsDiv.className = 'event-actions';
                actionsDiv.style.position = 'absolute';
                actionsDiv.style.bottom = '4px';
                actionsDiv.style.right = '6px';
                actionsDiv.style.display = 'flex';
                actionsDiv.style.gap = '6px';
                actionsDiv.style.zIndex = '3';
                actionsDiv.style.opacity = '0.6';
                actionsDiv.style.transition = 'opacity 0.2s';

                if (item.ev.parent_event_id && item.ev.invitation_status === 'accepted') {
                    var leaveBtn = document.createElement('button');
                    leaveBtn.className = 'event-action-btn';
                    leaveBtn.textContent = 'Leave';
                    leaveBtn.style.cssText = 'background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;line-height:1.2;';
                    leaveBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showConfirmModal('Leave this event?', async function() {
                            await deleteEventFromDB(item.ev.id);
                            events = events.filter(e => e.id !== item.ev.id);
                            renderCalendar();
                        });
                    });
                    actionsDiv.appendChild(leaveBtn);
                } else if (item.ev.invitation_status !== 'pending') {
                    // دکمه Cancel
                    var cancelBtn = document.createElement('button');
                    cancelBtn.className = 'event-action-btn';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;line-height:1.2;';
                    cancelBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showConfirmModal('Delete this event?', function() {
                            deleteEventById(item.ev.id);
                        });
                    });

                    // دکمه Done / End / Undo
                    var endBtn = document.createElement('button');
                    endBtn.className = 'event-action-btn';
                    endBtn.style.cssText = 'background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;line-height:1.2;';

                    // ── تسک هوشمند ──
                    if (item.ev.type === 'task' && item.ev.recurrence_type === 'smart') {
                        endBtn.textContent = 'Done';
                        endBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            completeSmartTask(item.ev);
                        });
                    }
                    // ── تسک عادی ──
                    else if (item.ev.type === 'task') {
                        var occDate = toLocalDateString(new Date(vy, vm, vd));
                        var isDone = item.ev.completed_occurrences && Array.isArray(item.ev.completed_occurrences)
                                        ? item.ev.completed_occurrences.includes(occDate)
                                        : false;
                        endBtn.textContent = isDone ? 'Undo' : 'Done';
                        endBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if (isDone) {
                                var idx = item.ev.completed_occurrences.indexOf(occDate);
                                if (idx > -1) item.ev.completed_occurrences.splice(idx, 1);
                                if (item.ev.completed_timestamps && item.ev.completed_timestamps[occDate]) {
                                    delete item.ev.completed_timestamps[occDate];
                                }
                                endBtn.textContent = 'Done';
                                evEl.style.opacity = '1';
                                evEl.style.textDecoration = 'none';
                                updateEventInDB(item.ev.id, {
                                    completed_occurrences: item.ev.completed_occurrences,
                                    completed_timestamps: item.ev.completed_timestamps
                                }).then(() => {
                                    if (currentUser) removeNotificationsForEvent(item.ev.id, currentUser.id);
                                }).catch(function() {});
                            } else {
                                if (!item.ev.completed_occurrences) item.ev.completed_occurrences = [];
                                item.ev.completed_occurrences.push(occDate);
                                if (!item.ev.completed_timestamps) item.ev.completed_timestamps = {};
                                item.ev.completed_timestamps[occDate] = new Date().toISOString();
                                endBtn.textContent = 'Undo';
                                evEl.style.opacity = '0.6';
                                evEl.style.textDecoration = 'line-through';
                                showToast('Occurrence marked done. Auto‑deleted in 28 days.');
                                updateEventInDB(item.ev.id, {
                                    completed_occurrences: item.ev.completed_occurrences,
                                    completed_timestamps: item.ev.completed_timestamps
                                }).then(() => {
                                    if (currentUser) removeNotificationsForEvent(item.ev.id, currentUser.id);
                                }).catch(function() {});
                            }
                            isDone = !isDone;
                        });
                        if (isDone) {
                            evEl.style.opacity = '0.6';
                            evEl.style.textDecoration = 'line-through';
                        }
                    }
                    // ── ایونت ──
                    else {
                        var occDate = toLocalDateString(new Date(vy, vm, vd));
                        var isCompleted = item.ev.completed_occurrences && Array.isArray(item.ev.completed_occurrences)
                                            ? item.ev.completed_occurrences.includes(occDate)
                                            : false;
                        endBtn.textContent = isCompleted ? 'Undo' : 'End';
                        endBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if (isCompleted) {
                                var idx = item.ev.completed_occurrences.indexOf(occDate);
                                if (idx > -1) item.ev.completed_occurrences.splice(idx, 1);
                                if (item.ev.completed_timestamps && item.ev.completed_timestamps[occDate]) {
                                    delete item.ev.completed_timestamps[occDate];
                                }
                                endBtn.textContent = 'End';
                                evEl.classList.remove('event-completed');
                                updateEventInDB(item.ev.id, {
                                    completed_occurrences: item.ev.completed_occurrences,
                                    completed_timestamps: item.ev.completed_timestamps
                                }).then(() => {
                                    if (currentUser) removeNotificationsForEvent(item.ev.id, currentUser.id);
                                }).catch(function() {});
                            } else {
                                if (!item.ev.completed_occurrences) item.ev.completed_occurrences = [];
                                item.ev.completed_occurrences.push(occDate);
                                if (!item.ev.completed_timestamps) item.ev.completed_timestamps = {};
                                item.ev.completed_timestamps[occDate] = new Date().toISOString();
                                endBtn.textContent = 'Undo';
                                evEl.classList.add('event-completed');
                                showToast('Event marked done. Auto‑deleted in 28 days.');
                                updateEventInDB(item.ev.id, {
                                    completed_occurrences: item.ev.completed_occurrences,
                                    completed_timestamps: item.ev.completed_timestamps
                                }).then(() => {
                                    if (currentUser) removeNotificationsForEvent(item.ev.id, currentUser.id);
                                }).catch(function() {});
                            }
                            isCompleted = !isCompleted;
                        });
                        if (isCompleted) {
                            evEl.classList.add('event-completed');
                        }
                    }

                    actionsDiv.appendChild(cancelBtn);
                    actionsDiv.appendChild(endBtn);
                }

                evEl.appendChild(actionsDiv);

                // کلیک اصلی
                evEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (item.ev.invitation_status === 'pending') {
                        openInvitationResponse(item.ev);
                    } else {
                        openEventDetail(item.ev, new Date(vy, vm, vd));
                    }
                });

                // هاور
                evEl.addEventListener('mouseenter', function() {
                    var acts = this.querySelector('.event-actions');
                    if (acts) acts.style.opacity = '1';
                });
                evEl.addEventListener('mouseleave', function() {
                    var acts = this.querySelector('.event-actions');
                    if (acts) acts.style.opacity = '0.6';
                });

                slots.appendChild(evEl);
            });
        });

        // ─── خط زمان فعلی ───
        var now = new Date();
        if (now.getFullYear() === vy && now.getMonth() === vm && now.getDate() === vd) {
            var nowMin = now.getHours() * 60 + now.getMinutes();
            var nowTopPx = 0;
            for (var h = 0; h < 24; h++) {
                if (h < Math.floor(nowMin / 60)) {
                    nowTopPx += hourHeights[h];
                } else if (h === Math.floor(nowMin / 60)) {
                    nowTopPx += (nowMin % 60) / 60 * hourHeights[h];
                    break;
                }
            }
            var line = document.createElement('div');
            line.className = 'current-time-line';
            line.style.position = 'absolute';
            line.style.left = '0';
            line.style.right = '-10px';
            line.style.height = '1px';
            line.style.background = 'var(--accent)';
            line.style.zIndex = '3';
            line.style.pointerEvents = 'none';
            line.style.top = nowTopPx + 'px';
            var dot = document.createElement('span');
            dot.style.position = 'absolute';
            dot.style.left = '-5px';
            dot.style.top = '-4px';
            dot.style.width = '9px';
            dot.style.height = '9px';
            dot.style.background = 'var(--accent)';
            dot.style.borderRadius = '50%';
            line.appendChild(dot);
            slots.appendChild(line);
        }

        // ─── کلیک روی فضای خالی ───
        slots.addEventListener('click', function(e) {
            if (e.target !== slots) return;
            var rect = slots.getBoundingClientRect();
            var y = e.clientY - rect.top;
            var acc = 0, clickMin = 0;
            for (var h = 0; h < 24; h++) {
                if (y < acc + hourHeights[h]) {
                    clickMin = h * 60 + ((y - acc) / hourHeights[h]) * 60;
                    break;
                }
                acc += hourHeights[h];
            }
            var hours = Math.floor(clickMin / 60);
            var minutes = Math.round(clickMin % 60);
            minutes = Math.round(minutes / 15) * 15;
            if (minutes === 60) { minutes = 0; hours++; }
            if (hours >= 24) hours = 23;
            var clickDate = new Date(vy, vm, vd, hours, minutes, 0, 0);
            openNewEventAtTime(clickDate);
        });
    });

    // ─── عنوان ───
    currentMonthYearEl.textContent = viewDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

/* ------------------------- YEAR VIEW ------------------------- */
function renderYearView() {
    calendarGrid.className = 'year-grid';
    calendarGrid.innerHTML = '';
    var today = new Date();
    var year = currentDate.getFullYear();
    currentMonthYearEl.textContent = year;
    for (var m = 0; m < 12; m++) calendarGrid.appendChild(makeYearMonthCard_Greg(year, m, today));
}

function makeYearMonthCard_Greg(year, month, today) {
    var card = document.createElement('div');
    card.className = 'year-month-card';
    var nameEl = document.createElement('div');
    nameEl.className = 'ym-name';
    nameEl.textContent = new Date(year, month).toLocaleString('en-US', {
        month: 'short'
    });
    card.appendChild(nameEl);
    var daysInMonth = new Date(year, month + 1, 0).getDate(),
        firstDay = new Date(year, month, 1).getDay();
    var miniGrid = document.createElement('div');
    miniGrid.className = 'ym-grid';
    for (var i = 0; i < firstDay; i++) miniGrid.appendChild(document.createElement('span'));
    for (var d = 1; d <= daysInMonth; d++) {
        var span = document.createElement('span');
        span.textContent = d;
        if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) span.className = 'ym-today';
        if (getGregHoliday(year, month, d)) span.classList.add('ym-holiday');
        miniGrid.appendChild(span);
    }
    card.appendChild(miniGrid);
    card.addEventListener('click', () => {
        currentDate = new Date(year, month, 1);
        viewMode = 'month';
        syncViewTabsUI();
        renderCalendar();
    });
    return card;
}

/* =========================== EVENT TYPE & TIME ============================ */
function setEventType(type) {
    eventType = type;
    const toggle = document.getElementById('event-type-toggle');
    if (!toggle) return;
    
    const labels = toggle.querySelectorAll('.event-type-label');
    const thumb = toggle.querySelector('.event-type-thumb');
    labels.forEach(l => l.classList.toggle('active', l.dataset.type === type));
    const activeLabel = toggle.querySelector(`.event-type-label[data-type="${type}"]`);
    if (activeLabel && thumb) {
        const labelRect = activeLabel.getBoundingClientRect();
        if (labelRect.width === 0) {
            requestAnimationFrame(() => setEventType(type));
            return;
        }
        const toggleRect = toggle.getBoundingClientRect();
        thumb.style.left = (labelRect.left - toggleRect.left) + 'px';
        thumb.style.width = labelRect.width + 'px';
    }

    const titleInput = document.getElementById('event-title');
    if (titleInput) {
        titleInput.placeholder = type === 'task' ? 'Task title' : 'Event title';
    }

    // ---- مدیریت دکمه‌های پایین textarea ----
    // دکمه‌های آیکون و رنگ همیشه نمایش داده می‌شن
    const iconBtn = document.getElementById('toggle-icon-btn');
    if (iconBtn) iconBtn.style.display = 'flex';
    
    const colorBtn = document.getElementById('toggle-color-btn');
    if (colorBtn) colorBtn.style.display = 'flex';

    // دکمه‌های شرطی
    const checklistBtn = document.getElementById('toggle-checklist-mode-btn');
    if (checklistBtn) {
        checklistBtn.style.display = (type === 'task') ? 'flex' : 'none';
    }

    const locBtn = document.getElementById('toggle-location-btn');
    if (locBtn) {
        locBtn.style.display = (type === 'event') ? 'flex' : 'none';
    }

    const inviteBtn = document.getElementById('toggle-invite-btn');
    if (inviteBtn) {
        inviteBtn.style.display = (type === 'event') ? 'flex' : 'none';
    }

    // اگر نوع تسک نیست، چک‌لیست رو مخفی کن
    if (type !== 'task') {
        hideInlineChecklist();
        currentChecklistItems = [];
    }

    updateAllDayAndTimeRows();
    syncTaskTimeVisibility();
}

/* ------------------------- TIME VALIDATION & SPINNER ------------------------- */
function getSelectedGregFor(prefix) {
    if (prefix === 'greg') {
        if (gregState.selectedGd === null) return null;
        return {
            gy: gregState.gy,
            gm: gregState.gm,
            gd: gregState.selectedGd
        };
    }
    return null;
}

function validateTimeInput(prefix, isEnd = false) {
    const hourEl = document.getElementById(prefix + (isEnd ? '-end-hour' : '-hour'));
    const minEl = document.getElementById(prefix + (isEnd ? '-end-minute' : '-minute'));
    if (!hourEl || !minEl) return;

    const g = getSelectedGregFor(prefix);
    if (!g) return;

    let hour = parseInt(hourEl.value, 10);
    let minute = parseInt(minEl.value, 10);
    if (isNaN(hour) || isNaN(minute)) return;

    minute = Math.round(minute / 15) * 15;
    if (minute === 60) {
        minute = 0;
        hour++;
    }

    if (!isEnd && isToday(g.gy, g.gm, g.gd)) {
        const now = new Date();
        const curHour = now.getHours();
        const curMinute = now.getMinutes();
        const nowTotal = curHour * 60 + curMinute;
        const selTotal = hour * 60 + minute;
        if (selTotal <= nowTotal) {
            let newMin = Math.ceil((curMinute + 1) / 15) * 15;
            let newHour = curHour + 1;
            if (newMin >= 60) {
                newMin = 0;
                newHour++;
            }
            newHour = newHour % 24;
            hour = newHour;
            minute = newMin;
        }
    }

    const startHourEl = document.getElementById(prefix + '-hour');
    const startMinEl = document.getElementById(prefix + '-minute');
    if (startHourEl && startMinEl) {
        const startH = parseInt(startHourEl.value, 10);
        const startM = parseInt(startMinEl.value, 10);
        if (!isNaN(startH) && !isNaN(startM)) {
            const startTotal = startH * 60 + startM;
            const endTotal = hour * 60 + minute;
            if (endTotal <= startTotal) {
                hour = (startH + 1) % 24;
                minute = startM;
            }
        }
    }

    hourEl.value = String(hour).padStart(2, '0');
    minEl.value = String(minute).padStart(2, '0');
}

function syncEndTimeOnStartChange(prefix) {
    const startHour = document.getElementById(prefix + '-hour');
    const startMin = document.getElementById(prefix + '-minute');
    const endHour = document.getElementById(prefix + '-end-hour');
    const endMin = document.getElementById(prefix + '-end-minute');
    if (!startHour || !startMin || !endHour || !endMin) return;

    const sh = parseInt(startHour.value, 10);
    const sm = parseInt(startMin.value, 10);
    if (isNaN(sh) || isNaN(sm)) return;

    const eh = parseInt(endHour.value, 10);
    const em = parseInt(endMin.value, 10);
    if (!isNaN(eh) && !isNaN(em)) {
        if (eh > sh || (eh === sh && em > sm)) return;
    }
    endHour.value = String((sh + 1) % 24).padStart(2, '0');
    endMin.value = String(sm).padStart(2, '0');
}

/* ------------------------- OPEN NEW EVENT AT TIME ------------------------- */
function openNewEventAtTime(date) {
    if (!currentUser) {
        openModal(authOverlay);
        authError.textContent = 'Please sign in to add events.';
        return;
    }

    editingEventId = null;
    eventTitleInput.value = '';
    eventType = 'event';
    setEventType('event');
    document.getElementById('event-type-toggle').style.display = '';

    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDate();
    var hours = date.getHours();
    var mins = date.getMinutes();

    var dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
    eventStartGreg.value = dateStr;
    eventStartInput.value = dateStr + 'T' + pad(hours) + ':' + pad(mins);
    gregDateRow.style.display = 'block';
    gregTriggerText.textContent = GREG_MONTH_NAMES[month] + ' ' + day + ', ' + year + '  ' + pad(hours) + ':' + pad(mins);
    gregPickerTrigger.classList.add('has-value');

    eventEndInput.value = '';
    selectedTagColor = '#f5f5f5';
    recurrence = {
        type: 'none',
        interval: 1,
        days: []
    };
    updateRecurrencePreview();
    hideInlineChecklist();
    currentChecklistItems = [];
    currentInvitees = [];
    document.getElementById('location-section').style.display = 'none';
    document.getElementById('toggle-location-btn')?.classList.remove('active');
    document.getElementById('toggle-invite-btn')?.classList.remove('active');
    document.getElementById('toggle-color-btn')?.classList.remove('active');
    document.getElementById('toggle-icon-btn')?.classList.remove('active');

    openModal(eventModal);
}

function openTitlePicker() {
    titlePickerActive = true;

    const gregAllDayRow = document.getElementById('all-day-greg-row');
    const gregTimeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    if (gregAllDayRow) gregAllDayRow.style.display = 'none';
    if (gregTimeRow) gregTimeRow.style.display = 'none';

    document.getElementById('greg-today-btn').style.display = 'block';

    openGregPicker(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
}

async function openEditModal(ev) {
    if (!ev) return;
    editingEventId = ev.id;
    document.getElementById('event-type-toggle').style.display = 'none';

    if (eventTitleInput) eventTitleInput.value = ev.title || '';

    if (ev.start_date) {
        const startDate = new Date(ev.start_date);
        const y = startDate.getFullYear();
        const m = startDate.getMonth();
        const d = startDate.getDate();
        const hours = startDate.getHours();
        const mins = startDate.getMinutes();

        if (eventStartGreg) eventStartGreg.value = `${y}-${pad(m + 1)}-${pad(d)}`;
        if (eventStartInput) eventStartInput.value = ev.start_date;
        if (gregTriggerText) {
            gregTriggerText.textContent = `${GREG_MONTH_NAMES[m]} ${d}, ${y}  ${pad(hours)}:${pad(mins)}`;
            gregPickerTrigger.classList.add('has-value');
        }
    } else {
        if (eventStartInput) eventStartInput.value = '';
        if (eventStartGreg) eventStartGreg.value = '';
        if (gregTriggerText) gregTriggerText.textContent = 'Select date';
        if (gregPickerTrigger) gregPickerTrigger.classList.remove('has-value');
    }

    if (eventEndInput) {
        eventEndInput.value = ev.end_date || '';
    }

    const gregCheck = document.getElementById('event-all-day-greg');
    if (gregCheck) gregCheck.checked = ev.all_day || false;

    setEventType(ev.type || 'event');
    const inviteBtn = document.getElementById('toggle-invite-btn');
    if (inviteBtn && ev.type === 'event') {
        inviteBtn.style.display = 'flex';
    }

    const locBtn = document.getElementById('toggle-location-btn');
    if (locBtn && ev.type === 'event') {
        locBtn.style.display = 'flex';
    }

    selectedTagColor = ev.color || '#f5f5f5';
    const colorBtn = document.getElementById('toggle-color-btn');
    if (colorBtn) {
        colorBtn.classList.toggle('active', selectedTagColor !== '#f5f5f5');
    }

    const descField = document.getElementById('event-description');
    if (descField) descField.value = ev.description || '';

    recurrence.type = ev.recurrence_type || 'none';
    recurrence.interval = ev.recurrence_interval || 1;
    recurrence.days = ev.recurrence_days || [];
    recurrence.smartInterval = ev.recurrence_smart_interval || 'weekly';
    updateRecurrencePreview();

    if (ev.type === 'task' && ev.checklist && ev.checklist.length) {
        currentChecklistItems = JSON.parse(JSON.stringify(ev.checklist));
        const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
        if (toggleBtn) {
            toggleBtn.style.display = 'flex';
        }
    } else {
        currentChecklistItems = [];
        hideInlineChecklist();
        const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    // Load location
    if (ev.location && (ev.location.lat || ev.location.name)) {
        currentLocationCoords = ev.location.lat && ev.location.lng ? {
            lat: ev.location.lat,
            lng: ev.location.lng
        } : null;
        currentLocationName = ev.location.name || '';
        currentLocationAddress = ev.location?.address || null;
        document.getElementById('location-section').style.display = 'none';
        const locBtn = document.getElementById('toggle-location-btn');
        if (locBtn) locBtn.classList.add('active');
    } else {
        currentLocationCoords = null;
        currentLocationName = '';
        currentLocationAddress = null;
        document.getElementById('location-coords-input').value = '';
        document.getElementById('location-section').style.display = 'none';
        const locBtn = document.getElementById('toggle-location-btn');
        if (locBtn) locBtn.classList.remove('active');
    }

    // Load invitees
    // Load invitees from invitee_ids (ecosystem)
    currentInvitees = [];
    if (ev.invitee_ids && Array.isArray(ev.invitee_ids) && ev.invitee_ids.length > 0) {
        try {
            const {
                data: profiles
            } = await sb.from('profiles')
                .select('id, first_name, last_name')
                .in('id', ev.invitee_ids);
            if (profiles) {
                currentInvitees = profiles.map(p => ({
                    id: p.id,
                    name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'User'
                }));
            }
        } catch (e) {
            currentInvitees = ev.invitee_ids.map(id => ({
                id,
                name: 'Unknown'
            }));
        }
    }
    if (currentInvitees.length > 0) {
        const inviteBtn = document.getElementById('toggle-invite-btn');
        if (inviteBtn) inviteBtn.classList.add('active');
    }

    if (gregDateRow) gregDateRow.style.display = 'block';
    updateAllDayAndTimeRows();
    openModal(eventModal);
}

/* =========================== SIDEBAR WEB COMPONENT ===========================
 * Author: Armin Silatani
 * Usage:  <sidebar-component current-app="Ravlo Calendar"></sidebar-component>
 *         Put app-specific content inside <div slot="app-content">...</div>
 * ========================================================================== */

const MENU_TOOLS = [
    { label: 'Codara Service Generator', minRole: 'general', link: 'https://arminsilatani.github.io/codara/', iconURL: 'assets/logos/Co.svg' },
    { label: 'Nolvo Sitemap Builder', minRole: 'general', link: '', iconURL: 'assets/logos/No.svg' },
    { label: 'Qerlo Shortener', minRole: 'general', link: '', iconURL: 'assets/logos/Qe.svg' },
    { label: 'Tivra Minify', minRole: 'general', link: '', iconURL: 'assets/logos/Ti.svg' },
    { label: 'Semora Schema Generator', minRole: 'general', link: '', iconURL: 'assets/logos/Se.svg' },
    { label: 'Brilo Speed Check', minRole: 'general', link: '', iconURL: 'assets/logos/Br.svg' },
    { label: 'Sorbi Robots Builder', minRole: 'general', link: '', iconURL: 'assets/logos/So.svg' },
    { label: 'Velto Meta Inspector', minRole: 'general', link: '', iconURL: 'assets/logos/Ve.svg' },
    { label: 'Zorio Image Converter', minRole: 'recruit', link: 'https://arminsilatani.github.io/zorio/', iconURL: 'assets/logos/Zo.svg' },
    { label: 'Galvo Video Converter', minRole: 'general', link: '', iconURL: 'assets/logos/Ga.svg' },
    { label: 'Xelpo Pass Generator', minRole: 'general', link: '', iconURL: 'assets/logos/Xe.svg' },
    { label: 'Dirmo DNS Checker', minRole: 'general', link: '', iconURL: 'assets/logos/Di.svg' },
    { label: 'Lemro Keyword Research', minRole: 'general', link: '', iconURL: 'assets/logos/Le.svg' },
    { label: 'Hirvo Density', minRole: 'general', link: '', iconURL: 'assets/logos/Hi.svg' },
    { label: 'Jorvi Redirect', minRole: 'general', link: '', iconURL: 'assets/logos/Jo.svg' },
    { label: 'Mirto CRM', minRole: 'general', link: '', iconURL: 'assets/logos/Mi.svg' },
    { label: 'Ravlo Calendar', minRole: 'sergeant', link: '', iconURL: 'assets/logos/Ra.svg', isSelf: true },
    { label: 'Rinvo Accounting', minRole: 'general', link: '', iconURL: 'assets/logos/Ri.svg' },
    { label: 'Yelmo Brand Namer', minRole: 'general', link: '', iconURL: 'assets/logos/Ye.svg' },
    { label: 'Cedro Flashcards', minRole: 'general', link: '', iconURL: 'assets/logos/Ce.svg' },
    { label: 'Fresca Colors Tool', minRole: 'general', link: '', iconURL: 'assets/logos/Fr.svg' },
    { label: 'Ubiro Beer Cost', minRole: 'general', link: '', iconURL: 'assets/logos/Ub.svg' },
    { label: 'Refacto Code Beautifier', minRole: 'general', link: '', iconURL: 'assets/logos/Re.svg' },
    { label: 'Pilvo Text Editor', minRole: 'recruit', link: 'https://arminsilatani.github.io/pilvo/', iconURL: 'assets/logos/Pi.svg' },
    { label: 'Tavio Prompt Library', minRole: 'recruit', link: 'https://arminsilatani.github.io/tavio/', iconURL: 'assets/logos/Ta.svg' },
    { label: 'Falco Favicon Generator', minRole: 'recruit', link: 'https://arminsilatani.github.io/falco/', iconURL: 'assets/logos/Fa.svg' },
    { label: 'Lume Epoch Converter', minRole: 'recruit', link: 'https://arminsilatani.github.io/lume/', iconURL: 'assets/logos/Lu.svg' },
    { label: 'Valeno Expiry Date Reminder', minRole: 'general', link: '', iconURL: 'assets/logos/Va.svg' },
    { label: 'Alviano Recipe Manager', minRole: 'general', link: '', iconURL: 'assets/logos/Al.svg' },
    { label: 'Mavero Workout Tracker', minRole: 'general', link: '', iconURL: 'assets/logos/Ma.svg' },
    { label: 'Tempozio Time Tracker', minRole: 'general', link: '', iconURL: 'assets/logos/Te.svg' },
    { label: 'Belluno Wishlist', minRole: 'general', link: '', iconURL: 'assets/logos/Be.svg' },
    { label: 'Nuvello Wallpaper App', minRole: 'general', link: '', iconURL: 'assets/logos/Nu.svg' },
    { label: 'Fiora Period Tracker', minRole: 'general', link: '', iconURL: 'assets/logos/Fi.svg' },
];

const ROLE_HIERARCHY = ['recruit', 'sergeant', 'commander', 'general'];

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
}

function hasAccess(userRole, minRole) {
    const normalizedUserRole = normalizeRole(userRole);
    const normalizedMinRole = normalizeRole(minRole || 'recruit');
    const userIndex = ROLE_HIERARCHY.indexOf(normalizedUserRole);
    const minIndex = ROLE_HIERARCHY.indexOf(normalizedMinRole);
    if (minIndex === -1 || userIndex === -1) return false;
    return userIndex >= minIndex;
}

class SidebarComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._currentUser = null;
        this._currentProfile = null;
        this._currentUserRole = 'public';
        this._events = [];
        this._isOpen = false;
    }

    static get observedAttributes() {
        return ['current-app'];
    }

    connectedCallback() {
        this.render();
        this._attachEvents();
        this._restoreSession();
    }

    /* ---------- PUBLIC API ---------- */
    setUser(user, profile) {
        this._currentUser = user;
        this._currentProfile = profile;
        this._currentUserRole = profile?.role || 'recruit';
        this._updateAuthUI();
        this._renderMenu();
        this._renderDashboardLink();
    }

    clearUser() {
        this._currentUser = null;
        this._currentProfile = null;
        this._currentUserRole = 'public';
        this._updateAuthUI();
        this._renderMenu();
        this._renderDashboardLink();
    }

    setEvents(events) {
        this._events = events || [];
        this._renderTodayList();
    }

    getCurrentUser() {
        return this._currentUser;
    }

    getCurrentProfile() {
        return this._currentProfile;
    }

    setNotificationDot(show) {
        const dot = this.shadowRoot.getElementById('avatar-notif-dot');
        if (dot) {
            dot.style.display = show ? 'block' : 'none';
        }
    }

    /* ---------- RENDER ---------- */
    render() {
        const currentApp = this.getAttribute('current-app') || '';
        this.shadowRoot.innerHTML = `
            <style>
                @import url('../shared/sidebar.css');
            </style>
            <button id="menu-toggle-btn" class="hamburger-btn" aria-label="Menu">
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
            </button>
            <div id="sidebar-overlay" class="sidebar-overlay"></div>
            <aside id="sidebar" class="sidebar">
                <div id="sidebar-close-row" class="sidebar-close-row">
                    <span>Close</span>
                </div>
                <div class="sidebar-separator"></div>
                <nav class="sidebar-nav" id="sidebar-nav">
                    <slot name="app-content"></slot>
                    <div id="sidebar-today-list" class="sidebar-today-list"></div>
                    <div class="sidebar-separator"></div>
                    <div id="sidebar-menu-items"></div>
                    <div class="sidebar-separator"></div>
                    <a id="sidebar-dashboard" class="sidebar-item hidden" href="https://arminsilatani.github.io/dashboard/" target="_blank">
                        <span class="sidebar-icon" style="position: relative;">
                            <span class="avatar-content"></span>
                            <span class="notification-dot" id="avatar-notif-dot" style="display: none;"></span>
                        </span>
                        <span class="sidebar-dashboard-text">Dashboard</span>
                    </a>
                    <button id="sidebar-login" class="sidebar-item login-item hidden">
                        <span class="sidebar-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                <polyline points="10 17 15 12 10 7"/>
                                <line x1="15" y1="12" x2="3" y2="12"/>
                            </svg>
                        </span>
                        <span>Sign In</span>
                    </button>
                    <button id="sidebar-logout" class="sidebar-item logout-item hidden">
                        <span class="sidebar-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                        </span>
                        <span>Logout</span>
                    </button>
                    <a id="sidebar-coffee" class="sidebar-item" href="#" target="_blank" rel="noopener noreferrer">
                        <span class="sidebar-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                                <line x1="6" y1="1" x2="6" y2="4"/>
                                <line x1="10" y1="1" x2="10" y2="4"/>
                                <line x1="14" y1="1" x2="14" y2="4"/>
                            </svg>
                        </span>
                        <span>Buy Me a Coffee</span>
                    </a>
                </nav>
            </aside>
        `;
    }

    /* ---------- EVENT HANDLING ---------- */
    _attachEvents() {
        const toggleBtn = this.shadowRoot.getElementById('menu-toggle-btn');
        const sidebar = this.shadowRoot.getElementById('sidebar');
        const overlay = this.shadowRoot.getElementById('sidebar-overlay');
        const closeRow = this.shadowRoot.getElementById('sidebar-close-row');

        const open = () => {
            if (this._isOpen) return;
            this._isOpen = true;
            toggleBtn.classList.add('open');
            overlay.classList.add('open');
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        };

        const close = () => {
            if (!this._isOpen) return;
            this._isOpen = false;
            toggleBtn.classList.remove('open');
            overlay.classList.remove('open');
            sidebar.style.transform = 'translateX(-100%)';
            sidebar.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        };

        toggleBtn.addEventListener('click', () => this._isOpen ? close() : open());
        overlay.addEventListener('click', close);
        closeRow.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) close();
        });

        // Auto-close when any .sidebar-item (including slotted ones) is clicked
        this.shadowRoot.getElementById('sidebar-nav').addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-item');
            if (item) {
                setTimeout(close, 150);
            }
        });

        this.shadowRoot.getElementById('sidebar-login').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('login-request', { bubbles: true, composed: true }));
        });

        this.shadowRoot.getElementById('sidebar-logout').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('logout-request', { bubbles: true, composed: true }));
        });
    }

    /* ---------- AUTH UI ---------- */
    _updateAuthUI() {
        const loginBtn = this.shadowRoot.getElementById('sidebar-login');
        const logoutBtn = this.shadowRoot.getElementById('sidebar-logout');
        if (!loginBtn || !logoutBtn) return;

        if (this._currentUser) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
        } else {
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
        }
        this._renderMenu();
        this._renderDashboardLink();
        this._renderTodayList();
    }

    /* ---------- MENU RENDERING ---------- */
    _renderMenu() {
        const container = this.shadowRoot.getElementById('sidebar-menu-items');
        if (!container) return;
        container.innerHTML = '';

        const role = normalizeRole(this._currentUserRole);

        MENU_TOOLS.forEach(tool => {
            if (tool.isSelf) return;
            const allowed = hasAccess(role, tool.minRole);
            const btn = document.createElement('button');
            btn.className = 'sidebar-item' + (allowed ? '' : ' disabled');
            btn.disabled = !allowed;
            btn.innerHTML = `
                <span class="sidebar-icon">
                    <img src="${tool.iconURL}" width="20" height="20" alt="${tool.label}">
                </span>
                <span>${tool.label}</span>
                ${!tool.link ? '<span class="coming-soon-tooltip">Coming Soon</span>' : ''}
            `;
            btn.addEventListener('click', () => {
                if (!this._currentUser) {
                    this.dispatchEvent(new CustomEvent('login-request', { bubbles: true, composed: true }));
                    return;
                }
                if (!hasAccess(this._currentUserRole, tool.minRole)) {
                    this.dispatchEvent(new CustomEvent('tool-click', {
                        detail: { tool, error: 'Access denied' },
                        bubbles: true,
                        composed: true
                    }));
                    return;
                }
                this.dispatchEvent(new CustomEvent('tool-click', {
                    detail: { tool },
                    bubbles: true,
                    composed: true
                }));
                if (tool.link) window.open(tool.link, '_blank');
            });
            container.appendChild(btn);
        });
    }

    _renderDashboardLink() {
        const dashboard = this.shadowRoot.getElementById('sidebar-dashboard');
        if (!dashboard) return;
        if (!this._currentProfile) {
            dashboard.classList.add('hidden');
            return;
        }
        dashboard.classList.remove('hidden');
        const fullName = [this._currentProfile.first_name, this._currentProfile.last_name]
            .filter(Boolean).join(' ') || 'Dashboard';
        const textSpan = dashboard.querySelector('.sidebar-dashboard-text');
        if (textSpan) textSpan.textContent = fullName;

        const avatarContent = dashboard.querySelector('.avatar-content');
        if (avatarContent) {
            if (this._currentProfile.photo_url) {
                avatarContent.innerHTML = `<img src="${this._currentProfile.photo_url}" alt="Profile" width="20" height="20" style="border-radius:50%; object-fit:cover;">`;
            } else {
                avatarContent.innerHTML = `<span class="avatar-initial" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:var(--accent, #ff6f91);color:white;border-radius:50%;font-size:12px;font-weight:bold;text-transform:uppercase;">${fullName.charAt(0)}</span>`;
            }
        }
    }

    _renderTodayList() {
        const container = this.shadowRoot.getElementById('sidebar-today-list');
        if (!container) return;
        if (!this._currentUser || this._events.length === 0) {
            container.innerHTML = '<div style="padding:8px 16px;font-size:12px;color:#555;">No events today</div>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const todayItems = this._events.filter(ev => {
            if (!ev.start_date || ev.status === 'done' || ev.status === 'completed') return false;
            const d = new Date(ev.start_date);
            return d.toISOString().split('T')[0] === todayStr;
        });

        if (todayItems.length === 0) {
            container.innerHTML = '<div style="padding:8px 16px;font-size:12px;color:#555;">No events today</div>';
            return;
        }

        let html = '<div style="padding:8px 16px; font-size:10px; text-transform:uppercase; color:#aaa; letter-spacing:0.5px;">Today</div>';
        todayItems.forEach(ev => {
            const color = ev.color || 'var(--accent, #ff6f91)';
            html += `
                <div class="sidebar-today-item" data-event-id="${ev.id}" style="cursor:pointer;">
                    <span class="dot" style="background:${color}"></span>
                    <span class="title">${ev.title || 'Untitled'}</span>
                </div>`;
        });
        container.innerHTML = html;
    }

    /* ---------- SESSION ---------- */
    _restoreSession() {
        this.dispatchEvent(new CustomEvent('session-restore-request', { bubbles: true, composed: true }));
    }
}

customElements.define('sidebar-component', SidebarComponent);