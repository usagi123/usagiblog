<!doctype html>
<html lang="en">
    <head>
        <!-- Required meta tags -->
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <!-- Night mode: apply saved choice (or OS preference) before paint -->
        <script>
        (function() {
            var theme = null;
            try { theme = localStorage.getItem('theme'); } catch (e) {}
            if (theme !== 'dark' && theme !== 'light') {
                theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', theme);
        })();
        </script>
        <!-- Bootstrap CSS -->
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
        <script>
        window.onscroll = function() {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                document.getElementById("myNav").style.background = "linear-gradient(rgba(20,20,20, .6), rgba(20,20,20, .5))";
                document.getElementById("myNav").style.transition = "background 2s ease 0s";
            } else {
                document.getElementById("myNav").style.background = "transparent";
            }
        };
        </script>
        <title><?php bloginfo('title'); ?></title>
        <?php wp_head(); ?>
    </head>

    <body <?php body_class(); ?>>
        <div class="aloha container-fluid">
            <div class="navbar navbar-expand-lg navbar-dark fixed-top" id="myNav" <?php echo (is_admin_bar_showing()) ? 'style="top: 32px;"' : ''; ?>>
                <div class="container custom-nav">
                    <a href="<?php echo get_home_url(); ?>" class="navbar-brand"><?php bloginfo('title'); ?></a>
                    <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle night mode" title="Toggle night mode">
                        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                    </button>
                    <script>
                    (function() {
                        var root = document.documentElement;
                        var btn = document.getElementById('themeToggle');
                        function saved() {
                            try { return localStorage.getItem('theme'); } catch (e) { return null; }
                        }
                        function sync() {
                            btn.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
                        }
                        btn.addEventListener('click', function() {
                            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                            root.setAttribute('data-theme', next);
                            try { localStorage.setItem('theme', next); } catch (e) {}
                            sync();
                        });
                        // Follow OS changes until the visitor picks a mode themselves
                        if (window.matchMedia) {
                            var mq = window.matchMedia('(prefers-color-scheme: dark)');
                            var onChange = function(e) {
                                if (saved() !== 'dark' && saved() !== 'light') {
                                    root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                                    sync();
                                }
                            };
                            if (mq.addEventListener) { mq.addEventListener('change', onChange); } else if (mq.addListener) { mq.addListener(onChange); }
                        }
                        sync();
                    })();
                    </script>
                    <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbar7">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="navbar-collapse collapse justify-content-stretch" id="navbar7">
                        <ul class="navbar-nav ml-auto">
                            <?php wp_nav_menu(); ?>
                        </ul>
                    </div>
                </div>
            </div>
        </div>