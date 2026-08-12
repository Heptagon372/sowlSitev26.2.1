import type { ActivityItem } from '@sowl/shared';
import { toast } from '../../components/toast';
import { ApiError, api } from '../../lib/api';
import { esc, fmtDateTime, initMemberPage } from '../layout';

const KIND: Record<ActivityItem['kind'], { icon: string; label: string; color: string }> = {
  NOTICE: { icon: '📢', label: '공지', color: 'var(--magenta-hi)' },
  SEMINAR: { icon: '🎤', label: '세미나', color: 'var(--cyan-hi)' },
  MISSION: { icon: '📝', label: '과제', color: 'var(--violet)' },
  STUDY: { icon: '📚', label: '스터디', color: 'var(--lime)' },
  PROJECT: { icon: '🚀', label: '프로젝트', color: 'var(--cyan)' },
  POST: { icon: '💬', label: '게시글', color: 'var(--muted)' },
  QUESTION: { icon: '❓', label: '질문', color: 'var(--violet)' },
  POLL: { icon: '📊', label: '설문', color: 'var(--magenta)' },
  FILE: { icon: '📎', label: '자료', color: 'var(--muted)' },
  EVENT: { icon: '🗓', label: '일정', color: 'var(--cyan)' },
};

/** #22 활동 기록 — 동아리 전체 활동 타임라인 */
async function main(): Promise<void> {
  const ctx = await initMemberPage('activities');
  if (!ctx) return;
  const { content } = ctx;

  const selected = new Set<ActivityItem['kind']>();

  content.innerHTML = `
    <div class="mpanel">
      <div class="mpanel__t">// 종류 필터 <span class="sp"></span>
        <span class="mtop__desc" id="tlCount"></span>
      </div>
      <div class="kindfilter" id="kindFilter">
        ${Object.entries(KIND)
          .map(
            ([k, v]) =>
              `<button class="kindchip" data-kind="${k}" style="--kc:${v.color}">${v.icon} ${v.label}</button>`,
          )
          .join('')}
      </div>
    </div>

    <div class="mpanel">
      <div class="mpanel__t">// 타임라인</div>
      <div class="timeline" id="tlList"><p class="mtop__desc">불러오는 중…</p></div>
    </div>`;

  const list = document.getElementById('tlList')!;

  async function load(): Promise<void> {
    try {
      const items = await api.member.activity.timeline({
        take: 80,
        kinds: selected.size ? [...selected] : undefined,
      });
      document.getElementById('tlCount')!.textContent = `${items.length}건`;

      let lastDay = '';
      list.innerHTML = items.length
        ? items
            .map((it) => {
              const k = KIND[it.kind];
              const day = it.at.slice(0, 10);
              const header =
                day !== lastDay
                  ? `<div class="timeline__day mono">${day.replace(/-/g, '.')}</div>`
                  : '';
              lastDay = day;
              const inner = `
            <div class="tlitem">
              <span class="tlitem__icon" style="--kc:${k.color}">${k.icon}</span>
              <div class="tlitem__body">
                <div class="tlitem__title">${esc(it.title)}</div>
                <div class="tlitem__meta">
                  <span class="mtag" style="border-color:color-mix(in srgb, ${k.color} 40%, transparent);color:${k.color}">${k.label}</span>
                  ${it.who ? `<span class="dim">${esc(it.who)}</span>` : ''}
                  ${it.detail ? `<span class="dim">${esc(it.detail)}</span>` : ''}
                  <span class="dim">${fmtDateTime(it.at)}</span>
                </div>
              </div>
            </div>`;
              return header + (it.href ? `<a href="${it.href}" class="tllink">${inner}</a>` : inner);
            })
            .join('')
        : '<p class="mtop__desc">아직 기록된 활동이 없습니다.</p>';
    } catch (e) {
      list.innerHTML = `<p class="mtop__desc">${e instanceof ApiError ? esc(e.message) : '타임라인을 불러오지 못했습니다.'}</p>`;
    }
  }

  document.querySelectorAll<HTMLButtonElement>('.kindchip').forEach((b) =>
    b.addEventListener('click', () => {
      const kind = b.dataset.kind as ActivityItem['kind'];
      if (selected.has(kind)) selected.delete(kind);
      else selected.add(kind);
      b.classList.toggle('on', selected.has(kind));
      void load();
    }),
  );

  await load();
}

void main();
