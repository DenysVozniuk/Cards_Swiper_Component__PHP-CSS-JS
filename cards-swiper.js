/* 
    Перед підключенням цього файлу JS обов'язково підключити JS файл Swiper:
    <script src="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js"></script>
*/

document.addEventListener('DOMContentLoaded', () => {
    const swiperBlocks = document.querySelectorAll('.cards-swiper');

    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

    function resolveMeta(config, currentBreakpoint) {
        const base = {
            show_arrows: config.showArrows ?? true,
            start_position: config.initialSlide ?? 0,

            speed: config.speed ?? 400,
            loop: config.loop ?? false,
            grabCursor: config.grabCursor ?? true,
            watchOverflow: config.watchOverflow ?? true,
            pagination: config.pagination ?? false,

            centeredSlides: config.centeredSlides ?? false,
            centeredSlidesBounds: config.centeredSlidesBounds ?? false,

            touchRatio: (typeof config.touchRatio === 'number' ? config.touchRatio : 1),
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
            centeredSlides: null,
            centeredSlidesBounds: null,
            touchRatio: null,
        };

        function goToIndex(index, speed = 0) {
            if (!swiper) return;

            const max = Math.max((config.cardsCount ?? 1) - 1, 0);
            const target = clamp(Math.abs(index), 0, max);

            if (swiper.params && swiper.params.loop) {
                swiper.slideToLoop(target, speed);
            } else {
                swiper.slideTo(target, speed);
            }
        }

        function syncEdges() {
            if (!swiper) return;

            const isLoop = !!swiper.params.loop;
            const isLocked = !!swiper.isLocked || (!swiper.allowSlideNext && !swiper.allowSlidePrev);

            if (!isLoop && !isLocked) {
                block.classList.toggle('is-beginning', swiper.isBeginning);
                block.classList.toggle('is-end', swiper.isEnd);
            } else {
                block.classList.remove('is-beginning', 'is-end');
            }

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
            const showArrows = meta.show_arrows !== false;
            if (navWrap) {
                navWrap.style.display = showArrows ? '' : 'none';
            } else if (hasNavDom) {
                btnPrev.hidden = !showArrows;
                btnNext.hidden = !showArrows;
            }

            if (typeof meta.start_position === 'number' && Number.isFinite(meta.start_position)) {
                goToIndex(meta.start_position, 0);
            }
        }

        function buildSwiperOptions(meta) {
            const tr = (typeof meta.touchRatio === 'number' && Number.isFinite(meta.touchRatio))
                ? Math.max(0, Math.min(meta.touchRatio, 10))
                : 1;

            const options = {
                slidesPerView: config.slidesPerView ?? 3,
                spaceBetween: config.spaceBetween ?? 12,
                initialSlide: config.initialSlide ?? 0,
                breakpoints: config.breakpoints ?? undefined,

                speed: meta.speed ?? 400,
                loop: !!meta.loop,
                grabCursor: meta.grabCursor !== false,
                watchOverflow: meta.watchOverflow !== false,

                centeredSlides: !!meta.centeredSlides,
                centeredSlidesBounds: !!meta.centeredSlidesBounds,

                touchRatio: tr,
            };

            if (hasNavDom) {
                options.navigation = {
                    prevEl: btnPrev,
                    nextEl: btnNext,
                    disabledClass: 'is-hidden',
                };
            }

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
            const nextCentered = !!meta.centeredSlides;
            const nextCenteredBounds = !!meta.centeredSlidesBounds;

            const nextTouchRatio = (typeof meta.touchRatio === 'number' && Number.isFinite(meta.touchRatio))
                ? Math.max(0, Math.min(meta.touchRatio, 10))
                : 1;

            const needReinit =
                lastApplied.loop !== nextLoop ||
                lastApplied.pagination !== nextPagination ||
                lastApplied.centeredSlides !== nextCentered ||
                lastApplied.centeredSlidesBounds !== nextCenteredBounds ||
                lastApplied.touchRatio !== nextTouchRatio;

            if (needReinit) {
                const keepIndex = (swiper.params && swiper.params.loop)
                    ? (swiper.realIndex ?? 0)
                    : (swiper.activeIndex ?? 0);

                destroySwiper();

                createSwiper(meta);
                goToIndex(keepIndex, 0);
            } else {
                applyMeta(meta);
                syncEdges();
            }

            lastApplied.loop = nextLoop;
            lastApplied.pagination = nextPagination;
            lastApplied.centeredSlides = nextCentered;
            lastApplied.centeredSlidesBounds = nextCenteredBounds;
            lastApplied.touchRatio = nextTouchRatio;
        }

        // INIT
        const initialMeta = resolveMeta(config, null);

        lastApplied.loop = !!initialMeta.loop;
        lastApplied.pagination = !!initialMeta.pagination;
        lastApplied.centeredSlides = !!initialMeta.centeredSlides;
        lastApplied.centeredSlidesBounds = !!initialMeta.centeredSlidesBounds;

        lastApplied.touchRatio = (typeof initialMeta.touchRatio === 'number' && Number.isFinite(initialMeta.touchRatio))
            ? Math.max(0, Math.min(initialMeta.touchRatio, 10))
            : 1;

        createSwiper(initialMeta);

        applyMeta(initialMeta);
        syncEdges();

        setTimeout(handleRecalc, 0);
    });
});
