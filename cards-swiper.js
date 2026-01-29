/* 
    Перед підключенням цього файлу JS обов'язково підключити JS файл Swiper:
    <script src="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js"></script>
*/

document.addEventListener('DOMContentLoaded', () => {
    const swiperBlocks = document.querySelectorAll('.cards-swiper');

    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

    // Беремо meta config для поточного min-width breakpoint
    function resolveMeta(config, currentBreakpoint) {
        const base = {
            show_arrows: config.showArrows ?? true,
            start_position: config.initialSlide ?? 0,

            speed: config.speed ?? 400,
            loop: config.loop ?? false,
            grabCursor: config.grabCursor ?? true,
            watchOverflow: config.watchOverflow ?? true,
            pagination: config.pagination ?? false,
        };

        const meta = config.metaBreakpoints || {};
        if (currentBreakpoint == null) return base;

        const key = String(currentBreakpoint);
        if (!Object.prototype.hasOwnProperty.call(meta, key)) return base;

        return { ...base, ...meta[key] };
    }

    swiperBlocks.forEach((block) => {
        let config = {};
        try {
            config = JSON.parse(block.dataset.swiperConfig || '{}');
        } catch (e) {
            console.warn('Invalid data-swiper-config JSON', block);
            return;
        }

        const swiperEl = block.querySelector('.swiper');
        if (!swiperEl) return;

        const navWrap = block.querySelector('[data-swiper-navigation]');
        const btnPrev = block.querySelector('[data-swiper-prev]');
        const btnNext = block.querySelector('[data-swiper-next]');
        const pagEl = block.querySelector('[data-swiper-pagination]');

        const hasNavDom = !!config.hasNavigationDom && !!btnPrev && !!btnNext;
        const hasPagDom = !!config.hasPaginationDom && !!pagEl;

        let swiper = null;
        let lastApplied = {
            loop: null,
            pagination: null,
        };

        function syncEdges() {
            if (!swiper) return;

            const isLoop = !!swiper.params.loop;

            // watchOverflow => swiper.isLocked (fallback на allowSlide*)
            const isLocked = !!swiper.isLocked || (!swiper.allowSlideNext && !swiper.allowSlidePrev);

            // Класи початок/кінець мають сенс лише без loop і без lock
            if (!isLoop && !isLocked) {
                block.classList.toggle('is-beginning', swiper.isBeginning);
                block.classList.toggle('is-end', swiper.isEnd);
            } else {
                block.classList.remove('is-beginning', 'is-end');
            }

            // Якщо лочиться — прибираємо навігацію/пагінацію (бо “гортати нема куди”)
            if (isLocked) {
                if (navWrap) navWrap.style.display = 'none';
                if (hasNavDom) {
                    btnPrev.hidden = true;
                    btnNext.hidden = true;
                    btnPrev.classList.add('is-hidden');
                    btnNext.classList.add('is-hidden');
                }
                if (pagEl) pagEl.style.display = 'none';
                return;
            } else {
                // Якщо розлочилось — повертаємо (але meta може ховати стрілки окремо)
                if (pagEl) pagEl.style.display = '';
            }

            if (hasNavDom) {
                if (!navWrap || navWrap.style.display !== 'none') {
                    if (isLoop) {
                        btnPrev.hidden = false;
                        btnNext.hidden = false;
                        btnPrev.classList.remove('is-hidden');
                        btnNext.classList.remove('is-hidden');
                    } else {
                        btnPrev.hidden = swiper.isBeginning;
                        btnNext.hidden = swiper.isEnd;
                        btnPrev.classList.toggle('is-hidden', swiper.isBeginning);
                        btnNext.classList.toggle('is-hidden', swiper.isEnd);
                    }
                }
            }
        }

        function applyMeta(meta) {
            // show_arrows
            const showArrows = meta.show_arrows !== false;
            if (navWrap) {
                navWrap.style.display = showArrows ? '' : 'none';
            } else if (hasNavDom) {
                btnPrev.hidden = !showArrows;
                btnNext.hidden = !showArrows;
            }

            // start_position (manual)
            if (typeof meta.start_position === 'number' && Number.isFinite(meta.start_position) && swiper) {
                const max = Math.max((config.cardsCount ?? 1) - 1, 0);
                const target = clamp(Math.abs(meta.start_position), 0, max);
                swiper.slideTo(target, 0);
            }
        }

        function buildSwiperOptions(meta) {
            const options = {
                slidesPerView: config.slidesPerView ?? 3,
                spaceBetween: config.spaceBetween ?? 12,
                initialSlide: config.initialSlide ?? 0,
                breakpoints: config.breakpoints ?? undefined,

                speed: meta.speed ?? 400,
                loop: !!meta.loop,
                grabCursor: meta.grabCursor !== false,
                watchOverflow: meta.watchOverflow !== false,
            };

            if (hasNavDom) {
                options.navigation = {
                    prevEl: btnPrev,
                    nextEl: btnNext,
                    disabledClass: 'is-hidden',
                };
            }

            // pagination: вмикаємо тільки якщо DOM є і meta.pagination=true
            if (hasPagDom && meta.pagination) {
                options.pagination = {
                    el: pagEl,
                    clickable: true,
                };
            }

            return options;
        }

        function createSwiper(meta) {
            const opts = buildSwiperOptions(meta);
            swiper = new Swiper(swiperEl, opts);

            swiper.on('slideChange', syncEdges);
            swiper.on('reachEnd', syncEdges);
            swiper.on('reachBeginning', syncEdges);
            swiper.on('breakpoint', handleRecalc);
            swiper.on('resize', handleRecalc);
            swiper.on('lock', syncEdges);
            swiper.on('unlock', syncEdges);


            syncEdges();
        }

        function destroySwiper() {
            if (!swiper) return;
            swiper.off('slideChange', syncEdges);
            swiper.off('reachEnd', syncEdges);
            swiper.off('reachBeginning', syncEdges);
            swiper.off('breakpoint', handleRecalc);
            swiper.off('resize', handleRecalc);
            swiper.off('lock', syncEdges);
            swiper.off('unlock', syncEdges);
            swiper.destroy(true, true);
            swiper = null;
        }

        function handleRecalc() {
            if (!swiper) return;

            const bp = swiper.currentBreakpoint ?? null;
            const meta = resolveMeta(config, bp);

            const nextLoop = !!meta.loop;
            const nextPagination = !!meta.pagination;

            const needReinit =
                lastApplied.loop !== nextLoop ||
                lastApplied.pagination !== nextPagination;

            if (needReinit) {
                // пам'ятаємо поточний індекс, щоб не "стрибало"
                const activeIndex = swiper.activeIndex ?? 0;

                destroySwiper();

                // після destroy створюємо з новими meta, і повертаємось на активний слайд
                createSwiper(meta);
                if (swiper) swiper.slideTo(activeIndex, 0);

            } else {
                // без re-init: просто застосовуємо meta-опції (start_position/show_arrows)
                applyMeta(meta);
                syncEdges();
            }

            lastApplied.loop = nextLoop;
            lastApplied.pagination = nextPagination;
        }

        // INIT
        const initialMeta = resolveMeta(config, null);

        lastApplied.loop = !!initialMeta.loop;
        lastApplied.pagination = !!initialMeta.pagination;

        createSwiper(initialMeta);

        // первинні ручні застосування (бо currentBreakpoint може бути null одразу)
        applyMeta(initialMeta);
        syncEdges();

        // одразу прогнати recalc після ініту, щоб підтягнути meta під реальний breakpoint
        // (Swiper інколи проставляє currentBreakpoint трохи пізніше)
        setTimeout(handleRecalc, 0);
    });
});
