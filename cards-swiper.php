<?php
// !!! При підключенні цього файлу обов'язково використовувати require_once або include_once !!!

declare(strict_types=1);

/**
 * @phpstan-type CardsSwiperBreakpointConfig array{
 *   cards_per_page?: float|int,
 *   gap?: string,
 *   show_arrows?: bool,
 *   start_position?: int,
 *   speed?: int,
 *   loop?: bool,
 *   grabCursor?: bool,
 *   watchOverflow?: bool,
 *   pagination?: bool
 * }
 *
 * @phpstan-type CardsSwiperBreakpoints array<string|int, CardsSwiperBreakpointConfig>
 *
 * @phpstan-type CardsSwiperArgs array{
 *   // REQUIRED
 *   root_class: string,
 *   cards: array<int, mixed>,
 *   card_body: callable(mixed): void,
 *
 *   // OPTIONAL (base)
 *   cards_per_page?: float|int,
 *   gap?: string,
 *   start_position?: int,
 *   show_arrows?: bool,
 *   breakpoints?: CardsSwiperBreakpoints|null,
 *   arrows_template?: callable(): void|null,
 *
 *   // OPTIONAL (Swiper)
 *   speed?: int,
 *   loop?: bool,
 *   grabCursor?: bool,
 *   watchOverflow?: bool,
 *   pagination?: bool
 * }
 */

/** @param CardsSwiperArgs $args */
function cards_swiper(array $args): void
{
    // -----------------------
    // 1) Defaults + required
    // -----------------------
    $defaults = [
        'root_class'      => '',
        'cards'           => [],
        'card_body'       => null,

        'cards_per_page'  => 3.0,
        'gap'             => '12px',

        'start_position'  => 0,
        'show_arrows'     => true,
        'breakpoints'     => null,
        'arrows_template' => null,

        'speed'           => 400,
        'loop'            => false,
        'grabCursor'      => true,
        'watchOverflow'   => true,
        'pagination'      => false,
    ];

    $a = array_merge($defaults, $args);

    // required validation
    if (!is_string($a['root_class'])) $a['root_class'] = (string)$a['root_class'];
    if (!is_array($a['cards'])) $a['cards'] = [];
    if (!isset($a['card_body']) || !is_callable($a['card_body'])) {
        return;
    }

    $root_class = $a['root_class'];
    $cards      = $a['cards'];

    /** @var callable(mixed):void $card_body */
    $card_body  = $a['card_body'];

    // -----------------------
    // 2) Helpers
    // -----------------------
    $cardsCount = count($cards);

    $gap_to_px = static function (string $value): float {
        if (preg_match('/-?\d+(\.\d+)?/', $value, $m)) {
            return (float)$m[0];
        }
        return 0.0;
    };

    $to_bool = static function ($v): bool {
        return (bool)$v;
    };

    $to_int = static function ($v, int $fallback = 0): int {
        if (is_numeric($v)) return (int)$v;
        return $fallback;
    };

    $to_float = static function ($v, float $fallback = 0.0): float {
        if (is_numeric($v)) return (float)$v;
        return $fallback;
    };

    // -----------------------
    // 3) Base values normalize
    // -----------------------
    $cards_per_page = round($to_float($a['cards_per_page'], 3.0), 1);
    $gap            = (string)$a['gap'];
    $spaceBetween   = $gap_to_px($gap);

    $start_position = $to_int($a['start_position'], 0);
    $show_arrows    = $to_bool($a['show_arrows']);

    $speed          = $to_int($a['speed'], 400);
    $loop           = $to_bool($a['loop']);
    $grabCursor     = $to_bool($a['grabCursor']);
    $watchOverflow  = $to_bool($a['watchOverflow']);
    $pagination     = $to_bool($a['pagination']);

    $breakpoints    = is_array($a['breakpoints']) ? $a['breakpoints'] : null;
    $arrows_template = is_callable($a['arrows_template']) ? $a['arrows_template'] : null;

    // base start_position -> initialSlide (кламп)
    $initialSlide = min(max(abs($start_position), 0), max($cardsCount - 1, 0));

    // -----------------------
    // 4) Normalize breakpoints (max-width keys)
    //    Allow override for:
    //    cards_per_page, gap, show_arrows, start_position,
    //    speed, loop, grabCursor, watchOverflow, pagination
    // -----------------------
    $normalized = [];
    if ($breakpoints) {
        foreach ($breakpoints as $k => $cfg) {
            if (!is_numeric((string)$k) || !is_array($cfg)) continue;

            $out = [];

            if (array_key_exists('cards_per_page', $cfg)) {
                $out['cards_per_page'] = round($to_float($cfg['cards_per_page'], $cards_per_page), 1);
            }
            if (array_key_exists('gap', $cfg)) {
                $out['gap'] = $gap_to_px((string)$cfg['gap']);
            }
            if (array_key_exists('show_arrows', $cfg)) {
                $out['show_arrows'] = $to_bool($cfg['show_arrows']);
            }
            if (array_key_exists('start_position', $cfg)) {
                $out['start_position'] = $to_int($cfg['start_position'], $start_position);
            }

            if (array_key_exists('speed', $cfg)) {
                $out['speed'] = $to_int($cfg['speed'], $speed);
            }
            if (array_key_exists('loop', $cfg)) {
                $out['loop'] = $to_bool($cfg['loop']);
            }
            if (array_key_exists('grabCursor', $cfg)) {
                $out['grabCursor'] = $to_bool($cfg['grabCursor']);
            }
            if (array_key_exists('watchOverflow', $cfg)) {
                $out['watchOverflow'] = $to_bool($cfg['watchOverflow']);
            }
            if (array_key_exists('pagination', $cfg)) {
                $out['pagination'] = $to_bool($cfg['pagination']);
            }

            $normalized[(int)$k] = $out; // max-width
        }
    }

    // -----------------------
    // 5) Convert max-width -> min-width maps
    // -----------------------
    $swiperBreakpoints = [];
    $metaBreakpoints = [];

    if ($normalized) {
        ksort($normalized);

        $minWidth = 0;
        foreach ($normalized as $maxWidth => $cfg) {
            $slides = array_key_exists('cards_per_page', $cfg) ? (float)$cfg['cards_per_page'] : $cards_per_page;
            $space  = array_key_exists('gap', $cfg) ? (float)$cfg['gap'] : $spaceBetween;

            $bpSwiper = [
                'slidesPerView' => $slides,
                'spaceBetween'  => $space,
            ];

            // Swiper-friendly
            if (array_key_exists('speed', $cfg)) $bpSwiper['speed'] = (int)$cfg['speed'];
            if (array_key_exists('grabCursor', $cfg)) $bpSwiper['grabCursor'] = (bool)$cfg['grabCursor'];
            if (array_key_exists('watchOverflow', $cfg)) $bpSwiper['watchOverflow'] = (bool)$cfg['watchOverflow'];

            $swiperBreakpoints[$minWidth] = $bpSwiper;

            // Meta (manual / re-init triggers)
            $meta = [];
            foreach (['show_arrows', 'start_position', 'loop', 'pagination', 'speed', 'grabCursor', 'watchOverflow'] as $k) {
                if (array_key_exists($k, $cfg)) {
                    $meta[$k] = $cfg[$k];
                }
            }
            if ($meta) $metaBreakpoints[$minWidth] = $meta;

            $minWidth = (int)$maxWidth + 1;
        }

        // default for > last maxWidth
        $swiperBreakpoints[$minWidth] = [
            'slidesPerView' => $cards_per_page,
            'spaceBetween'  => $spaceBetween,
            'speed'         => $speed,
            'grabCursor'    => $grabCursor,
            'watchOverflow' => $watchOverflow,
        ];
    } else {
        $swiperBreakpoints = [
            0 => [
                'slidesPerView' => $cards_per_page,
                'spaceBetween'  => $spaceBetween,
                'speed'         => $speed,
                'grabCursor'    => $grabCursor,
                'watchOverflow' => $watchOverflow,
            ],
        ];
    }

    // -----------------------
    // 6) Determine if we must render arrows/pagination in DOM at all
    // -----------------------
    $renderArrows = $show_arrows;
    $renderPagination = $pagination;

    if ($normalized) {
        foreach ($normalized as $cfg) {
            if (!$renderArrows && array_key_exists('show_arrows', $cfg) && $cfg['show_arrows'] === true) {
                $renderArrows = true;
            }
            if (!$renderPagination && array_key_exists('pagination', $cfg) && $cfg['pagination'] === true) {
                $renderPagination = true;
            }
        }
    }

    // -----------------------
    // 7) Build config JSON
    // -----------------------
    $oldSerializePrecision = ini_get('serialize_precision');
    $oldPrecision = ini_get('precision');
    ini_set('serialize_precision', '-1');
    ini_set('precision', '14');

    $config = [
        // base
        'slidesPerView'    => $cards_per_page,
        'spaceBetween'     => $spaceBetween,
        'initialSlide'     => $initialSlide,
        'cardsCount'       => $cardsCount,

        'speed'            => $speed,
        'loop'             => $loop,
        'grabCursor'       => $grabCursor,
        'watchOverflow'    => $watchOverflow,
        'pagination'       => $pagination,
        'showArrows'       => $show_arrows,

        // bps
        'breakpoints'      => $swiperBreakpoints,
        'metaBreakpoints'  => $metaBreakpoints,

        // dom flags
        'hasNavigationDom' => $renderArrows,
        'hasPaginationDom' => $renderPagination,
    ];

    $configJson = json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    ini_set('serialize_precision', (string)$oldSerializePrecision);
    ini_set('precision', (string)$oldPrecision);

    $id = 'cards_swiper_' . substr(md5($root_class . '|' . $cardsCount . '|' . microtime(true)), 0, 8);

    $default_arrows = static function (): void { ?>
        <div class="cards-swiper__navigation" data-swiper-navigation>
            <button class="cards-swiper__btn is-hidden" type="button" aria-label="Previous" data-swiper-prev>
                <svg width="20" height="20" viewBox="0 0 20 20" style="transform: rotate(180deg);" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.16663 9.99992L15.8333 9.99992M15.8333 9.99992L9.99996 4.16659M15.8333 9.99992L9.99996 15.8333" stroke="#F85628" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>

            <button class="cards-swiper__btn" type="button" aria-label="Next" data-swiper-next>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.16663 9.99992L15.8333 9.99992M15.8333 9.99992L9.99996 4.16659M15.8333 9.99992L9.99996 15.8333" stroke="#F85628" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
        </div>
    <?php };

    ?>
    <div
        class="<?= htmlspecialchars($root_class) ?> cards-swiper<?= $loop === true ? " is-loop" : "" ?> is-beginning"
        id="<?= $id ?>"
        data-swiper-config='<?= htmlspecialchars($configJson, ENT_QUOTES) ?>'>
        <div class="cards-swiper__wrapper">
            <div class="swiper">
                <div class="swiper-wrapper">
                    <?php foreach ($cards as $card): ?>
                        <div class="swiper-slide">
                            <?php $card_body($card); ?>
                        </div>
                    <?php endforeach; ?>
                </div>

                <?php if ($renderPagination): ?>
                    <div class="cards-swiper__pagination" data-swiper-pagination></div>
                <?php endif; ?>
            </div>
        </div>

        <?php if ($renderArrows): ?>
            <?php
            if ($arrows_template) {
                $arrows_template();
            } else {
                $default_arrows();
            }
            ?>
        <?php endif; ?>
    </div>
<?php
}

/* 
ПРИКЛАД ВИКОРИСТАННЯ

$cards = [
    [
        "link" => "/",
        "img_src" => "/assets/img/img-1.jpg",
        "alt" => "img-1",
        "title" => "Заголовок 1",
    ],
    [
        "link" => "/",
        "img_src" => "/assets/img/img-2.jpg",
        "alt" => "img-2",
        "title" => "Заголовок 2",
    ],
    [
        "link" => "/",
        "img_src" => "/assets/img/img-3.jpg",
        "alt" => "img-3",
        "title" => "Заголовок 3",
    ],
    [
        "link" => "/",
        "img_src" => "/assets/img/img-4.jpg",
        "alt" => "img-4",
        "title" => "Заголовок 4",
    ],
];

cards_swiper([
    // REQUIRED
    'root_class' => 'cards',
    'cards' => $cards,
    'card_body' => function ($card): void { ?>
        <div class="card">
            <div class="card__img-wrapper">
                <img src="<?= htmlspecialchars((string)$card['img_src']) ?>"
                    alt="<?= htmlspecialchars((string)$card['alt']) ?>">
            </div>

            <a class="link" href="<?= htmlspecialchars((string)$card['link']) ?>">
                <h3 class="card__title"><?= htmlspecialchars((string)$card['title']) ?></h3>
            </a>
        </div>
    <?php },

    // OPTIONAL (base)
    'cards_per_page' => 3.6,
    'gap' => '12px',
    'start_position' => 0,
    'show_arrows' => true,

    // OPTIONAL (Swiper base)
    'speed' => 450,
    'loop' => false,
    'grabCursor' => true,
    'watchOverflow' => true,
    'pagination' => true,

    // OPTIONAL: кастомні стрілки (важливо: data-swiper-prev / data-swiper-next)
    'arrows_template' => function (): void { ?>
        <div class="my-nav" data-swiper-navigation>
            <button type="button" data-swiper-prev aria-label="Previous">◀</button>
            <button type="button" data-swiper-next aria-label="Next">▶</button>
        </div>
    <?php },

    // OPTIONAL: max-width breakpoints (як у твоїй логіці)
    'breakpoints' => [
        // <= 1024
        '1024' => [
            'cards_per_page' => 2.6,
            'gap' => '12px',
            'speed' => 400,
            'loop' => false,
            'grabCursor' => true,
            'watchOverflow' => true,
            'pagination' => true,
            'show_arrows' => true,
            'start_position' => 0,
        ],

        // <= 850
        '850' => [
            'cards_per_page' => 1.4,
            'gap' => '10px',
            'speed' => 350,

            // приклад: на мобільному вмикаємо loop, вимикаємо пагінацію,
            // і ховаємо стрілки (але якщо в тебе JS зроблений так,
            // що при loop стрілки не ховаються — show_arrows можна лишити true)
            'loop' => true,
            'pagination' => false,
            'show_arrows' => true,

            // наприклад стартуємо з 1-го слайда
            'start_position' => 1,
        ],
    ],
]);
*/