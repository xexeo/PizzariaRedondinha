// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'start';
squiffy.story.id = '30f1c71605';
squiffy.story.sections = {
	'start': {
		'text': "<p>Você chegou à Pizzaria Redondinha, uma famosa pizzaria conhecida pelo seu excelente atendimento e deliciosas pizzas. Hoje, você tem a tarefa de entrevistar diferentes personagens para entender melhor o funcionamento da pizzaria e ajudar a construir um sistema de informações eficiente.</p>\n<p>Quem você gostaria de entrevistar primeiro?</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pizzaiolo\" role=\"link\" tabindex=\"0\">Entrevistar o Pizzaiolo</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Garcom\" role=\"link\" tabindex=\"0\">Entrevistar o Garçom/Garçonete</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Caixa\" role=\"link\" tabindex=\"0\">Entrevistar o Caixa</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Entregador\" role=\"link\" tabindex=\"0\">Entrevistar o Entregador</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Estoquista\" role=\"link\" tabindex=\"0\">Entrevistar o Estoquista</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Proprietario\" role=\"link\" tabindex=\"0\">Entrevistar o Proprietário</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Recepcionista\" role=\"link\" tabindex=\"0\">Entrevistar o Recepcionista</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Telefonista\" role=\"link\" tabindex=\"0\">Entrevistar a Telefonista</a></li>\n</ul>",
		'passages': {
		},
	},
	'Pizzaiolo': {
		'text': "<p>Você está na cozinha conversando com João, o pizzaiolo da Pizzaria Redondinha. Ele está ocupado preparando uma pizza margherita, mas está disposto a responder algumas perguntas.</p>\n<p>João é o mestre por trás das pizzas saborosas que servimos. Sua eficiência e atenção à qualidade são cruciais para a satisfação do cliente.</p>\n<p><strong>Você:</strong> Olá, João. Eu sou um analista de sistemas e estou aqui para entender melhor como podemos melhorar os processos na Pizzaria Redondinha. Você tem um momento para conversar?</p>\n<p><strong>João:</strong> Claro, só um instante enquanto coloco essa pizza no forno. Pronto, agora podemos conversar. O que você gostaria de saber?</p>\n<p>Escolha uma pergunta para fazer ao João:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta1Pizzaiolo\" role=\"link\" tabindex=\"0\">Qual é o papel mais crítico que você desempenha na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta2Pizzaiolo\" role=\"link\" tabindex=\"0\">Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta3Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você organiza seus pedidos atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta4Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você lida quando os ingredientes acabam?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta5Pizzaiolo\" role=\"link\" tabindex=\"0\">Há algo mais que você acha que poderia melhorar seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosPizzaiolo\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n</ul>",
		'passages': {
		},
	},
	'Pergunta1Pizzaiolo': {
		'text': "<p><strong>Você:</strong> Qual é o papel mais crítico que você desempenha na pizzaria?</p>\n<p><strong>João:</strong> Eu sou responsável por preparar as pizzas. É crucial que eu faça isso de forma eficiente e mantenha a qualidade, porque isso afeta diretamente a satisfação dos clientes. Se a pizza não está boa, o cliente não volta, e isso é ruim para o negócio.</p>\n<p><strong>João:</strong> Você sabia que o Garçom/Garçonete às vezes se atrapalha ao anotar os pedidos? Isso complica meu trabalho, especialmente nos horários de pico.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta2Pizzaiolo\" role=\"link\" tabindex=\"0\">Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta3Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você organiza seus pedidos atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta4Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você lida quando os ingredientes acabam?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta5Pizzaiolo\" role=\"link\" tabindex=\"0\">Há algo mais que você acha que poderia melhorar seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Pergunta2Pizzaiolo': {
		'text': "<p><strong>Você:</strong> Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</p>\n<p><strong>João:</strong> Um sistema que me permita ver os pedidos em tempo real seria fantástico. Às vezes, os pedidos chegam de forma confusa, especialmente durante os horários de pico. Também seria útil ter notificações quando os ingredientes estiverem acabando, assim eu poderia informar ao estoquista antes que seja tarde demais.</p>\n<p><strong>João:</strong> Ah, e o Estoquista também precisa de um sistema melhor. Às vezes, quando os ingredientes acabam, ele demora para repor, e isso atrasa tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta1Pizzaiolo\" role=\"link\" tabindex=\"0\">Qual é o papel mais crítico que você desempenha na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta3Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você organiza seus pedidos atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta4Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você lida quando os ingredientes acabam?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta5Pizzaiolo\" role=\"link\" tabindex=\"0\">Há algo mais que você acha que poderia melhorar seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Pergunta3Pizzaiolo': {
		'text': "<p><strong>Você:</strong> Como você organiza seus pedidos atualmente?</p>\n<p><strong>João:</strong> Usamos um quadro branco onde anotamos os pedidos, mas durante os horários de pico, pode ser difícil acompanhar tudo. Às vezes, os pedidos se perdem no meio da confusão, e isso é um problema.</p>\n<p><strong>João:</strong> A Telefonista também precisa de um sistema melhor. Às vezes, os pedidos que ela anota chegam errados, e isso complica tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta1Pizzaiolo\" role=\"link\" tabindex=\"0\">Qual é o papel mais crítico que você desempenha na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta2Pizzaiolo\" role=\"link\" tabindex=\"0\">Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta4Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você lida quando os ingredientes acabam?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta5Pizzaiolo\" role=\"link\" tabindex=\"0\">Há algo mais que você acha que poderia melhorar seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Pergunta4Pizzaiolo': {
		'text': "<p><strong>Você:</strong> Como você lida quando os ingredientes acabam?</p>\n<p><strong>João:</strong> Normalmente, temos que interromper o trabalho e procurar o estoquista. Se tivéssemos um sistema que alertasse automaticamente o estoquista quando os níveis de ingredientes estivessem baixos, economizaríamos muito tempo e evitaríamos atrasos.</p>\n<p><strong>João:</strong> O Proprietário precisa entender que precisamos de mais suporte durante os horários de pico. Às vezes, parece que estamos correndo contra o tempo e falta pessoal.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta1Pizzaiolo\" role=\"link\" tabindex=\"0\">Qual é o papel mais crítico que você desempenha na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta2Pizzaiolo\" role=\"link\" tabindex=\"0\">Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta3Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você organiza seus pedidos atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta5Pizzaiolo\" role=\"link\" tabindex=\"0\">Há algo mais que você acha que poderia melhorar seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Pergunta5Pizzaiolo': {
		'text': "<p><strong>Você:</strong> Há algo mais que você acha que poderia melhorar seu trabalho?</p>\n<p><strong>João:</strong> Talvez um sistema que também me permitisse ver o histórico dos pedidos. Por exemplo, se um cliente faz uma personalização específica frequentemente, seria útil saber disso para preparar a pizza conforme suas preferências sem ter que perguntar toda vez.</p>\n<p><strong>João:</strong> Ah, e entre nós, você sabia que estamos pensando em expandir a nossa cozinha? Com mais espaço e um sistema mais eficiente, poderíamos aumentar nossa produção e atender mais clientes. Só espero que o chefe consiga o financiamento necessário.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta1Pizzaiolo\" role=\"link\" tabindex=\"0\">Qual é o papel mais crítico que você desempenha na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta2Pizzaiolo\" role=\"link\" tabindex=\"0\">Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta3Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você organiza seus pedidos atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta4Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você lida quando os ingredientes acabam?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosPizzaiolo': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>João:</strong> Preciso de uma visão geral dos pedidos, com detalhes claros sobre cada um, um sistema de priorização, monitoramento de ingredientes em tempo real, estimativas de tempo de preparação, e um sistema de feedback dos clientes.</p>\n<p><strong>João:</strong> Ah, e o Garçom/Garçonete também poderia se beneficiar de um sistema melhor para gerenciar os pedidos. Às vezes, eles se atrapalham e os pedidos chegam atrasados na cozinha.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta1Pizzaiolo\" role=\"link\" tabindex=\"0\">Qual é o papel mais crítico que você desempenha na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta2Pizzaiolo\" role=\"link\" tabindex=\"0\">Que tipo de sistema você acha que poderia ajudá-lo em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta3Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você organiza seus pedidos atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Pergunta4Pizzaiolo\" role=\"link\" tabindex=\"0\">Como você lida quando os ingredientes acabam?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Garcom': {
		'text': "<p>Você está no salão conversando com o Garçom/Garçonete.</p>\n<p>O Garçom/Garçonete é a ligação direta entre os clientes e a cozinha, garantindo que os pedidos sejam feitos corretamente e entregues a tempo.</p>\n<p>Escolha uma pergunta para fazer ao Garçom/Garçonete:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"GarcomPergunta1\" role=\"link\" tabindex=\"0\">Como você lida com os pedidos dos clientes?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"GarcomPergunta2\" role=\"link\" tabindex=\"0\">O que você acha de um sistema que permita inserir pedidos digitalmente e enviá-los diretamente para a cozinha?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosGarcom\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'GarcomPergunta1': {
		'text': "<p><strong>Você:</strong> Como você lida com os pedidos dos clientes?</p>\n<p><strong>Garçom/Garçonete:</strong> Eu anoto os pedidos em um bloco de notas e os passo para a cozinha. Às vezes, isso pode ser confuso e levar a erros.</p>\n<p><strong>Garçom/Garçonete:</strong> E o Caixa também deveria ser mais ágil. Às vezes, demora muito para processar os pagamentos e os clientes ficam impacientes.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"GarcomPergunta2\" role=\"link\" tabindex=\"0\">O que você acha de um sistema que permita inserir pedidos digitalmente e enviá-los diretamente para a cozinha?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosGarcom\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'GarcomPergunta2': {
		'text': "<p><strong>Você:</strong> O que você acha de um sistema que permita inserir pedidos digitalmente e enviá-los diretamente para a cozinha?</p>\n<p><strong>Garçom/Garçonete:</strong> Isso seria ótimo! Isso reduziria os erros e tornaria o processo mais eficiente.</p>\n<p><strong>Garçom/Garçonete:</strong> E o Entregador às vezes reclama que os pedidos não estão prontos a tempo. Um sistema integrado poderia ajudar a resolver isso.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"GarcomPergunta1\" role=\"link\" tabindex=\"0\">Como você lida com os pedidos dos clientes?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosGarcom\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosGarcom': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>Garçom/Garçonete:</strong> Preciso de uma interface intuitiva para registrar pedidos, atualizações em tempo real, histórico do cliente, um sistema de pagamento integrado, capacidade de dividir contas, um sistema de reservas, e feedback dos clientes.</p>\n<p><strong>Garçom/Garçonete:</strong> Ah, e seria ótimo se a Telefonista pudesse registrar os pedidos de forma mais clara. Às vezes, os detalhes não chegam corretamente para nós.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"GarcomPergunta1\" role=\"link\" tabindex=\"0\">Como você lida com os pedidos dos clientes?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"GarcomPergunta2\" role=\"link\" tabindex=\"0\">O que você acha de um sistema que permita inserir pedidos digitalmente e enviá-los diretamente para a cozinha?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Caixa': {
		'text': "<p>Você está no balcão conversando com o Caixa.</p>\n<p>O Caixa é responsável por processar os pagamentos e gerenciar as transações financeiras.</p>\n<p>Escolha uma pergunta para fazer ao Caixa:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"CaixaPergunta1\" role=\"link\" tabindex=\"0\">Quais são os desafios que você enfrenta ao processar pagamentos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"CaixaPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema integrado de processamento de pagamentos poderia ajudá-lo?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosCaixa\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'CaixaPergunta1': {
		'text': "<p><strong>Você:</strong> Quais são os desafios que você enfrenta ao processar pagamentos?</p>\n<p><strong>Caixa:</strong> Às vezes, é difícil acompanhar todas as transações, especialmente durante os horários de pico.</p>\n<p><strong>Caixa:</strong> E o Garçom/Garçonete muitas vezes atrasa os pedidos. Isso deixa os clientes impacientes, especialmente quando estão prontos para pagar.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"CaixaPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema integrado de processamento de pagamentos poderia ajudá-lo?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosCaixa\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'CaixaPergunta2': {
		'text': "<p><strong>Você:</strong> Como um sistema integrado de processamento de pagamentos poderia ajudá-lo?</p>\n<p><strong>Caixa:</strong> Um sistema integrado seria útil para acompanhar todas as transações em tempo real e garantir que os pagamentos sejam processados corretamente.</p>\n<p><strong>Caixa:</strong> E o Entregador às vezes se confunde com os recibos. Um sistema claro e direto poderia evitar problemas na entrega.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"CaixaPergunta1\" role=\"link\" tabindex=\"0\">Quais são os desafios que você enfrenta ao processar pagamentos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosCaixa\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosCaixa': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>Caixa:</strong> Preciso de uma interface de pagamento integrada, detalhes claros do pedido, registro de entregas, intercomunicação com a equipe, controle de caixa, sistema de gorjetas, histórico de transações, e emissão de recibos.</p>\n<p><strong>Caixa:</strong> E o Estoquista deveria manter um controle melhor dos ingredientes. Às vezes, faltam itens no meio do expediente.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"CaixaPergunta1\" role=\"link\" tabindex=\"0\">Quais são os desafios que você enfrenta ao processar pagamentos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"CaixaPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema integrado de processamento de pagamentos poderia ajudá-lo?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Entregador': {
		'text': "<p>Você está na área de despacho conversando com o Entregador.</p>\n<p>O Entregador é o rosto da pizzaria para muitos de nossos clientes, entregando pizzas quentinhas diretamente à porta dos clientes.</p>\n<p>Escolha uma pergunta para fazer ao Entregador:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EntregadorPergunta1\" role=\"link\" tabindex=\"0\">Como você recebe informações sobre os pedidos de entrega?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"EntregadorPergunta2\" role=\"link\" tabindex=\"0\">Você acha que um sistema de navegação integrado com detalhes do pedido seria útil?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosEntregador\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'EntregadorPergunta1': {
		'text': "<p><strong>Você:</strong> Como você recebe informações sobre os pedidos de entrega?</p>\n<p><strong>Entregador:</strong> Atualmente, recebo os detalhes do pedido em um pedaço de papel, o que às vezes pode ser impreciso.</p>\n<p><strong>Entregador:</strong> O Garçom/Garçonete às vezes se atrapalha com os pedidos, e isso atrasa as entregas.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EntregadorPergunta2\" role=\"link\" tabindex=\"0\">Você acha que um sistema de navegação integrado com detalhes do pedido seria útil?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosEntregador\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'EntregadorPergunta2': {
		'text': "<p><strong>Você:</strong> Você acha que um sistema de navegação integrado com detalhes do pedido seria útil?</p>\n<p><strong>Entregador:</strong> Definitivamente! Isso tornaria as entregas mais eficientes e reduziria a chance de erros.</p>\n<p><strong>Entregador:</strong> E o Estoquista precisa ser mais ágil. Quando os ingredientes acabam, a produção atrasa e isso nos afeta diretamente.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EntregadorPergunta1\" role=\"link\" tabindex=\"0\">Como você recebe informações sobre os pedidos de entrega?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosEntregador\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosEntregador': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>Entregador:</strong> Preciso de informações detalhadas do pedido, um sistema de navegação integrado, sistema de comunicação, rastreamento de entregas, gerenciamento de pagamentos, sistema de priorização de entregas, feedback do cliente, e registro de gorjetas.</p>\n<p><strong>Entregador:</strong> O Caixa também deveria ser mais eficiente. Às vezes, os clientes reclamam da demora para receber o troco.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EntregadorPergunta1\" role=\"link\" tabindex=\"0\">Como você recebe informações sobre os pedidos de entrega?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"EntregadorPergunta2\" role=\"link\" tabindex=\"0\">Você acha que um sistema de navegação integrado com detalhes do pedido seria útil?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Estoquista': {
		'text': "<p>Você está no armazém conversando com o Estoquista.</p>\n<p>O Estoquista é o guardião dos ingredientes, garantindo que nunca fiquemos sem o que precisamos para fazer nossas pizzas incríveis.</p>\n<p>Escolha uma pergunta para fazer ao Estoquista:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EstoquistaPergunta1\" role=\"link\" tabindex=\"0\">Como você monitora os níveis de estoque atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"EstoquistaPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de estoque automatizado poderia ajudá-lo?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosEstoquista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'EstoquistaPergunta1': {
		'text': "<p><strong>Você:</strong> Como você monitora os níveis de estoque atualmente?</p>\n<p><strong>Estoquista:</strong> Eu faço verificações manuais regulares e mantenho um registro em papel.</p>\n<p><strong>Estoquista:</strong> E o Pizzaiolo deveria me avisar com mais antecedência quando os ingredientes estão acabando. Às vezes, ele só avisa quando já está no fim.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EstoquistaPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de estoque automatizado poderia ajudá-lo?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosEstoquista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'EstoquistaPergunta2': {
		'text': "<p><strong>Você:</strong> Como um sistema de gerenciamento de estoque automatizado poderia ajudá-lo?</p>\n<p><strong>Estoquista:</strong> Um sistema automatizado me permitiria monitorar os níveis de estoque em tempo real e receber notificações quando os ingredientes estiverem baixos. Isso tornaria o reabastecimento mais eficiente.</p>\n<p><strong>Estoquista:</strong> E o Proprietário deveria investir mais em tecnologia para facilitar nosso trabalho. Às vezes, as ferramentas que temos são obsoletas.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EstoquistaPergunta1\" role=\"link\" tabindex=\"0\">Como você monitora os níveis de estoque atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosEstoquista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosEstoquista': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>Estoquista:</strong> Preciso de um sistema de gerenciamento de estoque automatizado, notificações em tempo real, monitoramento de uso de ingredientes, comunicação com a equipe, e integração com fornecedores para pedidos automáticos.</p>\n<p><strong>Estoquista:</strong> Ah, e o Garçom/Garçonete deveria ser mais organizado. Às vezes, eles não informam corretamente o que falta na cozinha, e isso atrapalha tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"EstoquistaPergunta1\" role=\"link\" tabindex=\"0\">Como você monitora os níveis de estoque atualmente?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"EstoquistaPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de estoque automatizado poderia ajudá-lo?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Proprietario': {
		'text': "<p>Você está no escritório conversando com o Proprietário.</p>\n<p>O Proprietário é o timoneiro do negócio, mantendo a pizzaria rentável e com bom funcionamento.</p>\n<p>Escolha uma pergunta para fazer ao Proprietário:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de análise de dados poderia ajudá-lo a obter essas informações?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta3\" role=\"link\" tabindex=\"0\">Quais são os requisitos não funcionais mais importantes para o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta5\" role=\"link\" tabindex=\"0\">Você consideraria ter um aplicativo móvel onde os clientes podem fazer pedidos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta6\" role=\"link\" tabindex=\"0\">Para o software, você consideraria usar soluções de código aberto?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta7\" role=\"link\" tabindex=\"0\">Você consideraria usar Wi-Fi para os equipamentos dos garçons?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta8\" role=\"link\" tabindex=\"0\">Para os postos de trabalho, como o da telefonista, você mencionou o uso de PCs executando Linux. Isso é correto?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta1': {
		'text': "<p><strong>Você:</strong> Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</p>\n<p><strong>Proprietário:</strong> Relatórios de vendas, feedback do cliente e dados de desempenho da equipe são cruciais para tomar decisões informadas.</p>\n<p><strong>Proprietário:</strong> E o Pizzaiolo precisa ser mais rápido. Às vezes, ele atrasa os pedidos, especialmente quando está muito ocupado.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de análise de dados poderia ajudá-lo a obter essas informações?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta3\" role=\"link\" tabindex=\"0\">Quais são os requisitos não funcionais mais importantes para o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta2': {
		'text': "<p><strong>Você:</strong> Como um sistema de análise de dados poderia ajudá-lo a obter essas informações?</p>\n<p><strong>Proprietário:</strong> Um sistema de análise me permitiria visualizar esses dados de forma clara e concisa, facilitando a identificação de tendências e áreas que precisam de melhoria.</p>\n<p><strong>Proprietário:</strong> O Garçom/Garçonete também precisa ser mais eficiente. Às vezes, os clientes reclamam que não são atendidos a tempo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta3\" role=\"link\" tabindex=\"0\">Quais são os requisitos não funcionais mais importantes para o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta3': {
		'text': "<p><strong>Você:</strong> Quais são os requisitos não funcionais mais importantes para o sistema?</p>\n<p><strong>Proprietário:</strong> Os requisitos não funcionais mais importantes incluem desempenho, segurança, usabilidade, e escalabilidade. Precisamos garantir que o sistema possa lidar com picos de uso durante horários de pico, proteger os dados dos clientes, ser fácil de usar para nossos funcionários, e poder crescer junto com o negócio.</p>\n<p><strong>Proprietário:</strong> E a Telefonista também precisa de um sistema melhor. Às vezes, os pedidos chegam errados e isso complica tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de análise de dados poderia ajudá-lo a obter essas informações?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta4': {
		'text': "<p><strong>Você:</strong> Que tipo de equipamento você acha que seria necessário para a pizzaria?</p>\n<p><strong>Proprietário:</strong> Precisamos de tablets ou smartphones para os garçons fazerem pedidos, um PC para a telefonista e um sistema de ponto de venda (POS) robusto para o caixa. Eu gostaria de opções de hardware aberto para reduzir custos.</p>\n<p><strong>Proprietário:</strong> O Estoquista também precisa de mais suporte. Às vezes, ele fica sobrecarregado e isso atrasa a produção.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta2\" role=\"link\" tabindex=\"0\">Como um sistema de análise de dados poderia ajudá-lo a obter essas informações?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta5\" role=\"link\" tabindex=\"0\">Você consideraria ter um aplicativo móvel onde os clientes podem fazer pedidos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta6\" role=\"link\" tabindex=\"0\">Para o software, você consideraria usar soluções de código aberto?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta5': {
		'text': "<p><strong>Você:</strong> Você consideraria ter um aplicativo móvel onde os clientes podem fazer pedidos?</p>\n<p><strong>Proprietário:</strong> Sim, isso seria excelente. Mas eu gostaria que o aplicativo funcionasse tanto em Android quanto em iOS.</p>\n<p><strong>Proprietário:</strong> E o Garçom/Garçonete também precisa ser mais organizado. Às vezes, eles se atrapalham com os pedidos e isso complica tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta6\" role=\"link\" tabindex=\"0\">Para o software, você consideraria usar soluções de código aberto?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta6': {
		'text': "<p><strong>Você:</strong> Para o software, você consideraria usar soluções de código aberto?</p>\n<p><strong>Proprietário:</strong> Sim, eu prefiro soluções de código aberto sempre que possível.</p>\n<p><strong>Proprietário:</strong> Ah, e a Telefonista deveria ser mais ágil ao registrar os pedidos. Às vezes, ela demora e isso atrasa tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta5\" role=\"link\" tabindex=\"0\">Você consideraria ter um aplicativo móvel onde os clientes podem fazer pedidos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta7': {
		'text': "<p><strong>Você:</strong> Você consideraria usar Wi-Fi para os equipamentos dos garçons?</p>\n<p><strong>Proprietário:</strong> Sim, o Wi-Fi seria mais conveniente. No entanto, para a conexão entre o caixa e o servidor, eu preferiria uma conexão com fio para maior confiabilidade.</p>\n<p><strong>Proprietário:</strong> E o Entregador também precisa de um sistema melhor. Às vezes, ele se confunde com os endereços e isso atrasa as entregas.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta8\" role=\"link\" tabindex=\"0\">Para os postos de trabalho, como o da telefonista, você mencionou o uso de PCs executando Linux. Isso é correto?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'ProprietarioPergunta8': {
		'text': "<p><strong>Você:</strong> Para os postos de trabalho, como o da telefonista, você mencionou o uso de PCs executando Linux. Isso é correto?</p>\n<p><strong>Proprietário:</strong> Sim, isso mesmo. Eu prefiro usar Linux por sua segurança e confiabilidade. Além disso, é uma opção de código aberto, o que é ótimo.</p>\n<p><strong>Proprietário:</strong> O Garçom/Garçonete também precisa de um sistema melhor para gerenciar os pedidos. Às vezes, os pedidos chegam atrasados na cozinha.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta1\" role=\"link\" tabindex=\"0\">Como proprietário, quais informações você considera mais valiosas para a gestão da pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta4\" role=\"link\" tabindex=\"0\">Que tipo de equipamento você acha que seria necessário para a pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"ProprietarioPergunta5\" role=\"link\" tabindex=\"0\">Você consideraria ter um aplicativo móvel onde os clientes podem fazer pedidos?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Recepcionista': {
		'text': "<p>Você está na entrada conversando com o Recepcionista.</p>\n<p>O Recepcionista é o primeiro rosto que muitos de nossos clientes veem, gerenciando as mesas e a fila de espera para proporcionar uma experiência de cliente sem complicações.</p>\n<p>Escolha uma pergunta para fazer ao Recepcionista:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"RecepcionistaPergunta1\" role=\"link\" tabindex=\"0\">Como você gerencia a alocação de mesas e a lista de espera?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"RecepcionistaPergunta2\" role=\"link\" tabindex=\"0\">Você acha que um sistema de gerenciamento de reservas e lista de espera seria benéfico?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosRecepcionista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'RecepcionistaPergunta1': {
		'text': "<p><strong>Você:</strong> Como você gerencia a alocação de mesas e a lista de espera?</p>\n<p><strong>Recepcionista:</strong> Eu faço isso manualmente, o que pode ser desafiador quando estamos ocupados.</p>\n<p><strong>Recepcionista:</strong> E o Garçom/Garçonete às vezes se atrapalha com as reservas. Isso complica a organização das mesas.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"RecepcionistaPergunta2\" role=\"link\" tabindex=\"0\">Você acha que um sistema de gerenciamento de reservas e lista de espera seria benéfico?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosRecepcionista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'RecepcionistaPergunta2': {
		'text': "<p><strong>Você:</strong> Você acha que um sistema de gerenciamento de reservas e lista de espera seria benéfico?</p>\n<p><strong>Recepcionista:</strong> Sim, isso tornaria o processo mais eficiente e ajudaria a melhorar a experiência do cliente.</p>\n<p><strong>Recepcionista:</strong> E o Proprietário deveria considerar contratar mais pessoal durante os horários de pico. Às vezes, não damos conta de todos os clientes.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"RecepcionistaPergunta1\" role=\"link\" tabindex=\"0\">Como você gerencia a alocação de mesas e a lista de espera?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosRecepcionista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosRecepcionista': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>Recepcionista:</strong> Preciso de um sistema de reservas e ocupação de mesas, gerenciamento de fila de espera, notificações de limpeza, registros de clientes, comunicação com a equipe, reservas futuras, e gerenciamento de eventos especiais.</p>\n<p><strong>Recepcionista:</strong> E a Telefonista também deveria ter um sistema melhor. Às vezes, os clientes reclamam que as informações dadas por ela estão erradas.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"RecepcionistaPergunta1\" role=\"link\" tabindex=\"0\">Como você gerencia a alocação de mesas e a lista de espera?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"RecepcionistaPergunta2\" role=\"link\" tabindex=\"0\">Você acha que um sistema de gerenciamento de reservas e lista de espera seria benéfico?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'Telefonista': {
		'text': "<p>Você está no balcão de atendimento conversando com a Telefonista.</p>\n<p>A Telefonista é o ouvido atento que recebe os pedidos por telefone e lida com quaisquer problemas ou perguntas que os clientes possam ter.</p>\n<p>Escolha uma pergunta para fazer à Telefonista:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta1\" role=\"link\" tabindex=\"0\">Qual é o seu papel principal na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta2\" role=\"link\" tabindex=\"0\">Quais desafios você enfrenta ao atender chamadas e fazer pedidos por telefone?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta3\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de chamadas e pedidos integrado poderia ajudá-la em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosTelefonista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'TelefonistaPergunta1': {
		'text': "<p><strong>Você:</strong> Qual é o seu papel principal na pizzaria?</p>\n<p><strong>Telefonista:</strong> Eu sou responsável por atender chamadas de clientes que desejam fazer pedidos para entrega ou obter informações sobre nosso menu e serviços.</p>\n<p><strong>Telefonista:</strong> E o Garçom/Garçonete deveria ser mais claro ao informar os pedidos. Às vezes, os clientes ligam reclamando de erros nos pedidos.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta2\" role=\"link\" tabindex=\"0\">Quais desafios você enfrenta ao atender chamadas e fazer pedidos por telefone?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta3\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de chamadas e pedidos integrado poderia ajudá-la em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosTelefonista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'TelefonistaPergunta2': {
		'text': "<p><strong>Você:</strong> Quais desafios você enfrenta ao atender chamadas e fazer pedidos por telefone?</p>\n<p><strong>Telefonista:</strong> Às vezes, é difícil acompanhar todas as chamadas durante os horários de pico, e pode haver erros de comunicação ao anotar os pedidos manualmente.</p>\n<p><strong>Telefonista:</strong> E o Estoquista também precisa ser mais ágil ao repor os ingredientes. Às vezes, os clientes pedem algo que está em falta e isso complica as entregas.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta1\" role=\"link\" tabindex=\"0\">Qual é o seu papel principal na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta3\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de chamadas e pedidos integrado poderia ajudá-la em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosTelefonista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'TelefonistaPergunta3': {
		'text': "<p><strong>Você:</strong> Como um sistema de gerenciamento de chamadas e pedidos integrado poderia ajudá-la em seu trabalho?</p>\n<p><strong>Telefonista:</strong> Um sistema integrado me permitiria gerenciar chamadas de forma mais eficiente e inserir pedidos diretamente no sistema, reduzindo erros e melhorando a experiência do cliente.</p>\n<p><strong>Telefonista:</strong> E o Proprietário deveria investir em mais tecnologia. Às vezes, o sistema que usamos é lento e isso atrasa tudo.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta1\" role=\"link\" tabindex=\"0\">Qual é o seu papel principal na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta2\" role=\"link\" tabindex=\"0\">Quais desafios você enfrenta ao atender chamadas e fazer pedidos por telefone?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"PrincipaisPedidosTelefonista\" role=\"link\" tabindex=\"0\">Quais são os seus principais pedidos para melhorar o sistema?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
	'PrincipaisPedidosTelefonista': {
		'text': "<p><strong>Você:</strong> Quais são os seus principais pedidos para melhorar o sistema?</p>\n<p><strong>Telefonista:</strong> Preciso de um sistema de pedidos integrado, menu atualizado, histórico do cliente, status de pedidos em tempo real, sistema de reclamações, comunicação com a equipe, informações de entrega, e feedback do cliente.</p>\n<p><strong>Telefonista:</strong> E o Entregador deveria ser mais claro ao informar os status das entregas. Às vezes, os clientes ligam reclamando da demora.</p>\n<p>Escolha a próxima pergunta:</p>\n<ul>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta1\" role=\"link\" tabindex=\"0\">Qual é o seu papel principal na pizzaria?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta2\" role=\"link\" tabindex=\"0\">Quais desafios você enfrenta ao atender chamadas e fazer pedidos por telefone?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"TelefonistaPergunta3\" role=\"link\" tabindex=\"0\">Como um sistema de gerenciamento de chamadas e pedidos integrado poderia ajudá-la em seu trabalho?</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Voltar ao início</a></li>\n</ul>",
		'passages': {
		},
	},
}
})();