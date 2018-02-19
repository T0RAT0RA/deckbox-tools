<template>
    <div class="container-fluid">

        <div class="row my-2">
            <form class="form-inline mx-auto my-2 my-lg-0" @submit.prevent="send">
              <input class="username form-control mr-sm-2" type="text" placeholder="Deckbox username"
                  v-model="username"
              ></input>
              <button class="btn btn-secondary my-2 my-sm-0" type="button" @click="send">Calculate</button>
            </form>
        </div>

        <div class="row my-2">
            <div class="col-12">
                <transition name="fade">
                    <div class="progress" v-show="loading && !no_trades">
                        <div class="progress-bar" role="progressbar"
                            :aria-valuenow="progression"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            :style="'width: '+progression+'%'"
                        >
                        {{ progression }}%
                        </div>
                    </div>
                </transition>
            </div>
        </div>

        <div class="row" v-if="no_trades">
            <div class="col">
                <div class="card">
                    <div class="card-body">
                        No trades found for this user.
                    </div>
                </div>
            </div>
        </div>

        <div class="row" v-if="trades.length">
            <div class="col-md-3">
                <div class="card">
                  <div class="card-header">
                    Statistics
                  </div>
                  <ul class="list-group list-group-flush">
                    <li class="list-group-item">
                        Trades: {{ trades.length }}
                    </li>
                    <li class="list-group-item">
                        Overwall value:
                        <span class="badge" :class="{
                            'badge-success': totalBalance > 0,
                            'badge-danger': totalBalance < 0,
                        }">
                            ${{ totalBalance }}
                        </span>
                    </li>
                    <li class="list-group-item">
                        Best trade:
                        <span class="badge badge-success">${{ bestTrade.balance }}</span>
                        <a :href="'https://deckbox.org/trades/'+bestTrade.id" target="_blank">
                            #{{bestTrade.id}}
                        </a>
                    </li>
                    <li class="list-group-item">
                        Worst trade:
                        <span class="badge badge-danger">${{ worstTrade.balance }}</span>
                        <a :href="'https://deckbox.org/trades/'+worstTrade.id" target="_blank">
                            #{{worstTrade.id}}
                        </a>
                    </li>
                  </ul>
                </div>
            </div>

            <div class="col">
                <table class="trades table table-dark table-sm">
                    <thead>
                        <tr>
                            <th :class="headerClasses('id')" @click="sortCol('id')">Trade ID</th>
                            <th :class="headerClasses('name')" @click="sortCol('name')">Name</th>
                            <th :class="headerClasses('type')" @click="sortCol('type')">Type</th>
                            <th :class="headerClasses('sent')" @click="sortCol('sent')">Sent</th>
                            <th :class="headerClasses('received')" @click="sortCol('received')">Received</th>
                            <th :class="headerClasses('balance')" @click="sortCol('balance')">Balance</th>
                            <th :class="headerClasses('finished_at')" @click="sortCol('finished_at')">Finished on</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="trade in filteredTrades" v-if="!trade.loading" :class="{
                            'alert-success': trade.balance > 0,
                            'alert-danger': trade.balance < 0,
                            'alert-primary': trade.balance == 0,
                        }">
                            <td scope="row">
                                <a :href="'https://deckbox.org/trades/'+trade.id" target="_blank">
                                    #{{trade.id}}
                                </a>
                            </td>
                            <td>
                                <a :href="'https://deckbox.org/trades/'+trade.id" target="_blank">
                                    {{trade.name}}
                                </a>
                            </td>
                            <td>{{trade.type}}</td>
                            <td>{{trade.sent}}</td>
                            <td>{{trade.received}}</td>
                            <td>{{trade.balance}}</td>
                            <td>{{trade.finished_at}}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>

    </div>
</template>

<style lang="less" scoped>
    .trades {
        th {
            text-align: center;
            cursor: pointer;

            &.asc::after {
                content: " ^";
            }
            &.desc::after {
                content: " v";
            }
        }
    }

    .fade-leave-active, .fade-enter-active {
        transition: opacity 1s;
    }
    .fade-enter, .fade-leave-to {
        opacity: 0;
    }
</style>
<script>
var _ = require('lodash');
var moment = require('moment');

const request = require('superagent');
const $ = require('jquery');
const cache = require('lscache');

const cors_proxy = 'https://cors-anywhere.herokuapp.com/';
const deckbox_url = 'deckbox.org';

const FINISHED_MAIL_TRADES_SELECTOR = '.trades_listing.bordered_table:first';

function parsePrice(price) {
    if (!price) {
        return null;
    }
    return parseFloat(price.replace('$', '')).toFixed(2);
}

export default {
    name: 'Trade',
    data () {
        return {
            username: '',
            total_trades: 0,
            loading: false,
            no_trades: false,
            trades: [],
            sort: 'id',
            order: 'desc',
        }
    },
    watch: {
        progression: function() {
            if (this.progression >= 100) {
                this.loading = false;
            }
        }
    },
    computed: {
        loadedTrades: function() {
            return  _.filter(this.trades, ['loading', false]);
        },
        progression: function() {
            if (!this.total_trades) {
                return 0;
            }
            return Math.round(this.loadedTrades.length / this.total_trades * 100);
        },
        filteredTrades: function() {
            const TRADE_NAME_LIMIT = 25;

            //Convert values
            let sortedtrades = this.trades.map((t) => {
                t.id = parseInt(t.id);
                t.balance = parseFloat(t.balance);
                t.received = parseFloat(t.received);
                t.sent = parseFloat(t.sent);
                t.finished_at = moment(t.finished_at).format('YYYY-MM-DD');
                t.name = t.name.length <= TRADE_NAME_LIMIT? t.name : t.name.substring(0, TRADE_NAME_LIMIT) + '...';
            });
            sortedtrades = _.sortBy(this.trades, [this.sort]);
            return (this.order == 'asc')? sortedtrades : sortedtrades.reverse();
        },
        totalBalance: function() {
            let balance = this.trades.reduce((o, t) => o + t.balance, 0);

            if (!balance) {
                return null;
            }

            return parseFloat(balance).toFixed(2);
        },
        bestTrade: function() {
            return _.sortBy(this.trades, ['balance']).reverse()[0];
        },
        worstTrade: function() {
            return _.sortBy(this.trades, ['balance'])[0];
        },
    },
    methods: {
        headerClasses: function(col) {
            return {
                sort: this.sort == col,
                asc: this.sort == col && this.order == 'asc',
                desc: this.sort == col && this.order == 'desc',
            };
        },
        sortCol: function(col) {
            if (col == this.sort) {
                this.order = (this.order == 'desc')? 'asc' : 'desc';
            } else {
                this.order = 'desc';
            }
            this.sort = col;
        },
        parseTrades: function(html) {
            const finished_trades = html.find(FINISHED_MAIL_TRADES_SELECTOR);
            const trades = finished_trades.find('.simple_table tr:gt(0)');
            trades.each((i, el) => {
                const $trade = $(el);
                const trade_url = $trade.find('td:first a:first').attr('href');
                const id = trade_url.match(/\/([0-9]+)\?/)[1];

                let trade = {};

                trade = cache.get(`trade_${id}`);
                if (!trade) {
                    trade = {
                        id,
                        finished_at: moment.unix($trade.find('td:last').text().match(/, ([0-9]*)\)/)[1]).format(),
                        trade_url,
                        loading: true,
                        balance: 0,
                    };

                    if (trade_url) {
                        request
                            .get(`${cors_proxy}${deckbox_url}${trade_url}`)
                            .end((err, res) => {
                                const html = $(res.text);
                                const sent = html.find(`#trade .section_title a[href*="/users/${this.username}"]`).parents('.half_min_page').find('.center.price.strong').html();
                                const received = html.find(`#trade .section_title a[href*="/users/"]:not([href*="${this.username}"])`).parents('.half_min_page').find('.center.price.strong').html();

                                const $name = html.find('#trade_name').text().trim();

                                trade.name = $name.match(/(.*)\s*\(/)[1];
                                trade.type = $name.match(/\((.*)\)/)[1].toLowerCase();
                                trade.received = parsePrice(received);
                                trade.sent = parsePrice(sent);
                                trade.balance = (trade.received - trade.sent).toFixed(2);
                                trade.loading = false;

                                //cache trade
                                cache.set(`trade_${trade.id}`, trade, 720); //12h cache
                            })
                    }
                }

                this.trades.push(trade);
            });
        },
        send: function() {
            this.loading = true;
            this.no_trades = false;
            this.trades = [];
            request
                .get(`${cors_proxy}${deckbox_url}/users/${this.username}/trades/`)
                .end((err, res) => {
                    const html = $(res.text);
                    const finished_trades = html.find(FINISHED_MAIL_TRADES_SELECTOR);

                    if (!finished_trades.length) {
                        this.no_trades = true;
                        return;
                    }

                    this.total_trades = parseInt(finished_trades.find('.pagination_controls b').html());
                    const total_pages = finished_trades.find('.pagination_controls span').html().match(/of ([0-9]*)/)[1];

                    this.parseTrades(html)

                    //First page is already parsed
                    for (let page = 2; page <= total_pages; page++ ) {
                        request
                            .get(`${cors_proxy}${deckbox_url}/users/${this.username}/trades?p1=${page}`)
                            .end((err, res) => {
                                this.parseTrades($(res.text))
                            });
                    }
                });
        }
    }
}
</script>
