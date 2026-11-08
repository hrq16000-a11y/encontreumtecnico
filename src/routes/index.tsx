import type { CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import capturedCSS from "../styles/site.css?raw";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home - Encontre um técnico | Preciso de um técnico" }] }),
  staticData: { importedDocument: { html: { "lang": "pt-BR" }, body: { "className": "home page vc_responsive elementor-default js active" } } },
  component: Index,
});

function Index() {
  return (
    <>
      <style>{capturedCSS}</style>
      <div className="cky-overlay cky-hide" />
      <div className="cky-btn-revisit-wrapper cky-revisit-hide cky-revisit-bottom-left items-center bottom-[15px] justify-center [cursor:pointer]" style={{ backgroundColor: "rgb(0, 86, 167)" }} data-tooltip="Preferências de consentimento">
        <button className="cky-btn-revisit items-center justify-center" aria-label="Preferências de consentimento">
          <img src="/site-assets/09323ad162c86ea1-db67a0f68cb287c80ad51bfd5cb0b32f.png" alt="Revisit consent button" />
        </button>
      </div>
      <div className="cky-consent-container cky-box-bottom-left" tabIndex={0}>
        <div className="cky-consent-bar" style={{ backgroundColor: "rgb(255, 255, 255)", borderColor: "rgb(244, 244, 244)" }}>
          <div className="cky-notice">
            <p className="cky-title" style={{ color: "rgb(33, 33, 33)" }} role="heading" aria-level={1}>Valorizamos sua privacidade</p>
            <div className="cky-notice-group">
              <div className="cky-notice-des [@media(max-width:440px)]:max-h-[40vh]" style={{ color: "rgb(33, 33, 33)" }}>
                <p>Utilizamos cookies para aprimorar sua experiência de navegação, exibir anúncios ou conteúdo personalizado e analisar nosso tráfego. Ao clicar em “Aceitar todos”, você concorda com nosso uso de cookies.</p>
              </div>
              <div className="cky-notice-btn-wrapper items-center flex-wrap justify-start [@media(max-width:440px)]:flex-col"> <button className="cky-btn cky-btn-customize flex-auto text-center [max-width:100%] [min-height:0px] [@media(max-width:440px)]:[order:2]" style={{ color: "rgb(24, 99, 220)", backgroundColor: "transparent", borderColor: "rgb(24, 99, 220)" }} aria-label="Personalizar">Personalizar</button> <button className="cky-btn cky-btn-reject flex-auto text-center [max-width:100%] [min-height:0px] [@media(max-width:440px)]:[order:3]" style={{ color: "rgb(24, 99, 220)", backgroundColor: "transparent", borderColor: "rgb(24, 99, 220)" }} aria-label="Rejeitar">Rejeitar</button> <button className="cky-btn cky-btn-accept flex-auto text-center [max-width:100%] [min-height:0px] [@media(max-width:440px)]:[order:1]" style={{ color: "rgb(255, 255, 255)", backgroundColor: "rgb(24, 99, 220)", borderColor: "rgb(24, 99, 220)" }} aria-label="Aceitar tudo">Aceitar tudo</button>  </div>
            </div>
          </div>
        </div>
      </div>
      <div className="cky-modal [transition:all]" tabIndex={0}>
        <div className="cky-preference-center flex-1 flex-col" style={{ color: "rgb(33, 33, 33)", backgroundColor: "rgb(255, 255, 255)", borderColor: "rgb(244, 244, 244)" }}>
          <div className="cky-preference-header items-center justify-between"> <span className="cky-preference-title" style={{ color: "rgb(33, 33, 33)" }} role="heading" aria-level={1}>Personalizar preferências de consentimento</span> <button className="cky-btn-close align-middle [min-height:0px]" aria-label="[cky_preference_close_label]">{" "}<img src="/site-assets/422f874fddd39740-f765876fc2d241775e0674ac6ea40b36.png" alt="Close" />{" "}</button> </div>
          <div className="cky-preference-body-wrapper flex-1">
            <div className="cky-preference-content-wrapper" style={{ color: "rgb(33, 33, 33)" }}>
              <p>Utilizamos cookies para ajudar você a navegar com eficiência e executar certas funções. Você encontrará informações detalhadas sobre todos os cookies sob cada categoria de consentimento abaixo.</p>
              <p>Os cookies que são classificados com a marcação “Necessário” são armazenados em seu navegador, pois são essenciais para possibilitar o uso de funcionalidades básicas do site.... <button className="cky-show-desc-btn [min-height:0px]" aria-label="Mostrar mais">Mostrar mais</button></p>
            </div>
            <div className="cky-accordion-wrapper">
              <div className="cky-accordion" id="ckyDetailCategorynecessary">
                <div className="cky-accordion-item">
                  <div className="cky-accordion-chevron [cursor:pointer]">
                    <i />
                  </div>
                  <div className="cky-accordion-header-wrapper [cursor:pointer]">
                    <div className="cky-accordion-header items-center justify-between">
                      <button className="cky-accordion-btn [min-height:0px]" style={{ color: "rgb(33, 33, 33)" }} aria-label="Necessário" aria-expanded="false">Necessário</button>
                      <span className="cky-always-active">Sempre ativo</span>
                    </div>
                    <div className="cky-accordion-header-des" style={{ color: "rgb(33, 33, 33)" }}>
                      <p>Os cookies necessários são cruciais para as funções básicas do site e o site não funcionará como pretendido sem eles.</p>
                      <p>Esses cookies não armazenam nenhum dado pessoalmente identificável.</p>
                    </div>
                  </div>
                </div>
                <div className="cky-accordion-body">
                  <div className="cky-audit-table" style={{ color: "rgb(33, 33, 33)", backgroundColor: "rgb(244, 244, 244)", borderColor: "rgb(235, 235, 235)" }}>
                    <p className="cky-empty-cookies-text">Sem cookies para exibir.</p>
                  </div>
                </div>
              </div>
              <div className="cky-accordion" id="ckyDetailCategoryfunctional">
                <div className="cky-accordion-item">
                  <div className="cky-accordion-chevron [cursor:pointer]">
                    <i />
                  </div>
                  <div className="cky-accordion-header-wrapper [cursor:pointer]">
                    <div className="cky-accordion-header items-center justify-between">
                      <button className="cky-accordion-btn [min-height:0px]" style={{ color: "rgb(33, 33, 33)" }} aria-label="Funcional" aria-expanded="false">Funcional</button>
                    </div>
                    <div className="cky-accordion-header-des" style={{ color: "rgb(33, 33, 33)" }}>
                      <p>Cookies funcionais ajudam a executar certas funcionalidades, como compartilhar o conteúdo do site em plataformas de mídia social, coletar feedbacks e outros recursos de terceiros.</p>
                    </div>
                  </div>
                </div>
                <div className="cky-accordion-body">
                  <div className="cky-audit-table" style={{ color: "rgb(33, 33, 33)", backgroundColor: "rgb(244, 244, 244)", borderColor: "rgb(235, 235, 235)" }}>
                    <p className="cky-empty-cookies-text">Sem cookies para exibir.</p>
                  </div>
                </div>
              </div>
              <div className="cky-accordion" id="ckyDetailCategoryanalytics">
                <div className="cky-accordion-item">
                  <div className="cky-accordion-chevron [cursor:pointer]">
                    <i />
                  </div>
                  <div className="cky-accordion-header-wrapper [cursor:pointer]">
                    <div className="cky-accordion-header items-center justify-between">
                      <button className="cky-accordion-btn [min-height:0px]" style={{ color: "rgb(33, 33, 33)" }} aria-label="Analíticos" aria-expanded="false">Analíticos</button>
                    </div>
                    <div className="cky-accordion-header-des" style={{ color: "rgb(33, 33, 33)" }}>
                      <p>Cookies analíticos são usados para entender como os visitantes interagem com o site. Esses cookies ajudam a fornecer informações sobre métricas o número de visitantes, taxa de rejeição, fonte de tráfego, etc.</p>
                    </div>
                  </div>
                </div>
                <div className="cky-accordion-body">
                  <div className="cky-audit-table" style={{ color: "rgb(33, 33, 33)", backgroundColor: "rgb(244, 244, 244)", borderColor: "rgb(235, 235, 235)" }}>
                    <p className="cky-empty-cookies-text">Sem cookies para exibir.</p>
                  </div>
                </div>
              </div>
              <div className="cky-accordion" id="ckyDetailCategoryperformance">
                <div className="cky-accordion-item">
                  <div className="cky-accordion-chevron [cursor:pointer]">
                    <i />
                  </div>
                  <div className="cky-accordion-header-wrapper [cursor:pointer]">
                    <div className="cky-accordion-header items-center justify-between">
                      <button className="cky-accordion-btn [min-height:0px]" style={{ color: "rgb(33, 33, 33)" }} aria-label="Desempenho" aria-expanded="false">Desempenho</button>
                    </div>
                    <div className="cky-accordion-header-des" style={{ color: "rgb(33, 33, 33)" }}>
                      <p>Os cookies de desempenho são usados para entender e analisar os principais índices de desempenho do site, o que ajuda a oferecer uma melhor experiência do usuário para os visitantes.</p>
                    </div>
                  </div>
                </div>
                <div className="cky-accordion-body">
                  <div className="cky-audit-table" style={{ color: "rgb(33, 33, 33)", backgroundColor: "rgb(244, 244, 244)", borderColor: "rgb(235, 235, 235)" }}>
                    <p className="cky-empty-cookies-text">Sem cookies para exibir.</p>
                  </div>
                </div>
              </div>
              <div className="cky-accordion" id="ckyDetailCategoryadvertisement">
                <div className="cky-accordion-item">
                  <div className="cky-accordion-chevron [cursor:pointer]">
                    <i />
                  </div>
                  <div className="cky-accordion-header-wrapper [cursor:pointer]">
                    <div className="cky-accordion-header items-center justify-between">
                      <button className="cky-accordion-btn [min-height:0px]" style={{ color: "rgb(33, 33, 33)" }} aria-label="Anúncio" aria-expanded="false">Anúncio</button>
                    </div>
                    <div className="cky-accordion-header-des" style={{ color: "rgb(33, 33, 33)" }}>
                      <p>Os cookies de anúncios são usados para entregar aos visitantes anúncios personalizados com base nas páginas que visitaram antes e analisar a eficácia da campanha publicitária.</p>
                    </div>
                  </div>
                </div>
                <div className="cky-accordion-body">
                  <div className="cky-audit-table" style={{ color: "rgb(33, 33, 33)", backgroundColor: "rgb(244, 244, 244)", borderColor: "rgb(235, 235, 235)" }}>
                    <p className="cky-empty-cookies-text">Sem cookies para exibir.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="cky-footer-wrapper">
            <span className="cky-footer-shadow bottom-[calc(100%_-_1px)]" style={{ background: "linear-gradient(rgba(255, 255, 255, 0) 0%, rgb(255, 255, 255) 100%)" }} />
            <div className="cky-prefrence-btn-wrapper items-center flex-wrap justify-center [@media(max-width:576px)]:flex-col"> <button className="cky-btn cky-btn-reject flex-auto text-center [max-width:100%] [min-height:0px] [@media(max-width:576px)]:[order:3]" style={{ color: "rgb(24, 99, 220)", backgroundColor: "transparent", borderColor: "rgb(24, 99, 220)" }} aria-label="Rejeitar"> Rejeitar </button> <button className="cky-btn cky-btn-preferences flex-auto text-center [max-width:100%] [min-height:0px] [@media(max-width:576px)]:[order:2]" style={{ color: "rgb(24, 99, 220)", backgroundColor: "transparent", borderColor: "rgb(24, 99, 220)" }} aria-label="Salve minhas preferências"> Salve minhas preferências </button> <button className="cky-btn cky-btn-accept flex-auto text-center [max-width:100%] [min-height:0px] [@media(max-width:576px)]:[order:1]" style={{ color: "rgb(255, 255, 255)", backgroundColor: "rgb(24, 99, 220)", borderColor: "rgb(24, 99, 220)" }} aria-label="Aceitar tudo"> Aceitar tudo </button> </div>
          </div>
        </div>
      </div>
      <div id="termly-code-snippet-support" />
      <div className="careerfy-mobile-hdr-sidebar [transition:0.3s]">
        <div className="careerfy-sidebar-navigation [transition:0.3s]" style={{ display: "none" }}>
          <ul className="careerfy-mobile-navbar list-none" id="careerfy-mobile-navbar-nav">
            <li id="menu-item-322">
              <a href="/lista-de-clientes">Cliente</a>
              <span className="child-navitms-opner [cursor:pointer] [transition:0.2s_ease-in-out]">
                <i className="fa fa-angle-down [text-rendering:auto]" />
              </span>
              <ul className="sidebar-submenu list-none">
                <li id="menu-item-350">
                  <a href="/publicar-nova-atividade">Preciso de um técnico</a>
                </li>
              </ul>
            </li>
            <li id="menu-item-3040">
              <a href={"/lista-de-tecnicos?ajax_filter=true&sort-by=recent&posted=all"}>Listas de técnicos e prestadores</a>
              <span className="child-navitms-opner [cursor:pointer] [transition:0.2s_ease-in-out]">
                <i className="fa fa-angle-down [text-rendering:auto]" />
              </span>
              <ul className="sidebar-submenu list-none">
                <li id="menu-item-3001">
                  <a href="/o-que-e-field-service">O que é Field Service?</a>
                </li>
                <li id="menu-item-323" />
              </ul>
            </li>
            <li id="menu-item-318">
              <a href="/?page_id=178">Sobre nós</a>
              <span className="child-navitms-opner [cursor:pointer] [transition:0.2s_ease-in-out]">
                <i className="fa fa-angle-down [text-rendering:auto]" />
              </span>
              <ul className="sidebar-submenu list-none">
                <li id="menu-item-3002">
                  <a href="/como-funciona">Como Funciona</a>
                </li>
                <li id="menu-item-747">
                  <a href="/termos-e-condicoes">Termos e Condições</a>
                </li>
                <li id="menu-item-355">
                  <a href="/faqs">FAQ’S</a>
                </li>
              </ul>
            </li>
            <li id="menu-item-344">
              <a href="/news">News</a>
              <span className="child-navitms-opner [cursor:pointer] [transition:0.2s_ease-in-out]">
                <i className="fa fa-angle-down [text-rendering:auto]" />
              </span>
              <ul className="sidebar-submenu list-none">
                <li id="menu-item-754">
                  <a href="https://old.encontreumtecnico.com/">Site de 2024</a>
                </li>
              </ul>
            </li>
            <li id="menu-item-352">
              <a href="/contato">Contato</a>
            </li>
          </ul>
        </div>
        <div className="jobsearch-mobile-notificsdet" style={{ display: "none" }}>
          <ul>
            <li className="jobsearch-usernotifics-menubtn">
              <div className="jobsearch-hdernotifics-listitms float-left text-left [transition:0.4s_ease-in-out]">
                <div className="hdernotifics-title-con float-left"><span className="hder-notifics-title">Notificações</span><span className="hder-notifics-count float-right">0 novo</span></div>
                <span className="hder-notifics-nofound float-left">Você não tem notificações.</span>
              </div>
            </li>
          </ul>
        </div>
        <a className="mobile-navclose-btn text-center">
          <i className="fa fa-times [text-rendering:auto]" />
        </a>
      </div>
      <div className="careerfy-wrapper">
        <div className="careerfy-loading-section text-center" style={{ display: "none" }}>
          <div className={"\x6cine-scale-pulse-out"}>
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>
        <ImportedHeader />
        <div className="careerfy-mobilehder-strip float-left" style={{ display: "none" }}>
          <div className="mobile-hder-topcon float-left">
            <div className="mobile-logocon align-middle">
              <a className="jobsearch-responsive-logo float-left" href="/" title="Encontre um técnico | Preciso de um técnico">
                <img src="/site-assets/99bf6851eea67efa.webp" height="60" alt="Encontre um técnico | Preciso de um técnico" />
              </a>
            </div>
            <div className="mobile-right-btnscon align-middle"><a className="mobile-navigation-togglebtn float-right" id="careerfy-mobile-navbtn"><i className="fa fa-bars [text-rendering:auto]" /></a><a className="jobsearch-useracount-hdrbtn jobsearch-open-signin-tab float-right text-center"><i className="fa fa-user [text-rendering:auto]" /></a><a className="mobile-usernotifics-btn float-right text-center"><i className="fa fa-bell [text-rendering:auto]" /><span className="hderbell-notifics-count">0</span></a></div>
          </div>
        </div>
        <div className="clearfix" />
        <div className="careerfy-main-content no-page-spacing careerfy-full-wide-page">
          <div className="page" id="post-2336">
            <div>
              <div className="wpb-content-wrapper">
                <div className="vc_row wpb_row vc_custom_1738490174777 vc_row-has-fill vc_row-o-full-height vc_row-o-columns-middle vc_row-flex content-center flex-wrap" style={{ minHeight: "89.4676vh" }} data-site-import-responsive="55">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_animate_when_almost_visible bounceInUp wpb_column vc_column_container vc_col-sm-12 vc_col-has-fill wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "translate3d(0px, 0px, 0px)", opacity: "1" }}>
                        <div className="vc_column-inner vc_custom_1738494095213">
                          <div className="wpb_wrapper">
                            <div className="careerfy-typo-wrap vc_custom_1738611882937">
                              <div className="careerfy-banner-caption flex-wrap justify-center text-center">
                                <h1 style={{ color: "rgb(255, 255, 255)" }}>Precisa de um Técnico?</h1>
                                <p style={{ color: "rgb(255, 255, 255)" }}>Somos a primeira, a única e<br /><b>a melhor plataforma para<br />
      encontrar técnicos</b> em todo o país.</p>
                                <p>Conectar você ao profissional mais qualificado,<br />
      garantindo que cada desafio seja superado<br />
      com excelência e agilidade.<br /><b>Precisou, encontrou.</b></p>
                                <p>
                                  <b>Os melhores técnicos estão aqui!</b>
                                </p>
                                <div className="clearfix" />
                                <div className="careerfy-banner-btn">
                                  <a className="careerfy-bgcolorhover float-left" style={{ color: "rgb(255, 255, 255)", backgroundColor: "rgb(79, 135, 251)" }} href="/lista-de-tecnicos"><i className="careerfy-icon careerfy-support align-sub" />Encontrar um técnico</a>
                                </div>
                              </div>
                            </div>
                            <div className="wpb_content_element vc_custom_1738495811993">
                              <div className="wpb_wrapper">
                                <div>
                                  <div className="rating-wrapper items-center justify-center [-webkit-box-align:center] [-webkit-box-pack:center] [@media(max-width:750px)]:items-center [@media(max-width:750px)]:flex-col [@media(max-width:750px)]:[-webkit-box-align:center] [@media(max-width:750px)]:[-webkit-box-direction:normal] [@media(max-width:750px)]:[-webkit-box-orient:vertical]">
                                    <div className="rating-container items-center gap-[8px] justify-center [-webkit-box-align:center] [-webkit-box-pack:center]">
                                      <div className="rating-numbers items-center justify-center [-webkit-box-align:center] [-webkit-box-pack:center]"><span className="rating-value">4.5</span><span className="rating-max">/5</span></div>
                                      <div><span style={{ width: "1em" }}>{"\n"}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">{"\n"}<path d="M8 12.2961L12.8984 15.2648L11.5996 9.69839L15.9043 5.95035L10.2266 5.46793L8 0.235504L5.77344 5.46793L0.0957031 5.95035L4.40039 9.69839L3.10156 15.2648L8 12.2961Z" fill="#FFBB34" />{"\n"}</svg>{"\n"}</span><span style={{ width: "1em" }}>{"\n"}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">{"\n"}<path d="M8 12.2961L12.8984 15.2648L11.5996 9.69839L15.9043 5.95035L10.2266 5.46793L8 0.235504L5.77344 5.46793L0.0957031 5.95035L4.40039 9.69839L3.10156 15.2648L8 12.2961Z" fill="#FFBB34" />{"\n"}</svg>{"\n"}</span><span style={{ width: "1em" }}>{"\n"}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">{"\n"}<path d="M8 12.2961L12.8984 15.2648L11.5996 9.69839L15.9043 5.95035L10.2266 5.46793L8 0.235504L5.77344 5.46793L0.0957031 5.95035L4.40039 9.69839L3.10156 15.2648L8 12.2961Z" fill="#FFBB34" />{"\n"}</svg>{"\n"}</span><span style={{ width: "1em" }}>{"\n"}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">{"\n"}<path d="M8 12.2961L12.8984 15.2648L11.5996 9.69839L15.9043 5.95035L10.2266 5.46793L8 0.235504L5.77344 5.46793L0.0957031 5.95035L4.40039 9.69839L3.10156 15.2648L8 12.2961Z" fill="#FFBB34" />{"\n"}</svg>{"\n"}</span><span style={{ width: "1em" }}>{"\n"}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">{"\n"}<path d="M8 12.2961L12.8984 15.2648L11.5996 9.69839L15.9043 5.95035L10.2266 5.46793L8 0.235504L5.77344 5.46793L0.0957031 5.95035L4.40039 9.69839L3.10156 15.2648L8 12.2961Z" fill="#FFBB34" />{"\n"}</svg>{"\n"}</span></div>
                                    </div>
                                    <div className="rating-icons items-center gap-[16px] [-webkit-box-align:center]">
                                      <div>
                                        <svg width="57" height="24" viewBox="0 0 57 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M43.3519 10.484V18.5634C43.3519 21.8869 41.3919 23.2443 39.0748 23.2443C36.8936 23.2443 35.5808 21.7854 35.0858 20.5924L36.8064 19.8762C37.1127 20.6086 37.8635 21.473 39.0727 21.473C40.5559 21.473 41.475 20.5579 41.475 18.8353V18.188H41.4061C40.9637 18.7338 40.1116 19.2106 39.0362 19.2106C36.7861 19.2106 34.7246 17.2506 34.7246 14.7286C34.7246 12.1883 36.7861 10.2121 39.0362 10.2121C40.1095 10.2121 40.9617 10.6889 41.4061 11.2185H41.475V10.486H43.3519V10.484ZM41.615 14.7286C41.615 13.144 40.5579 11.9854 39.2127 11.9854C37.8492 11.9854 36.7069 13.144 36.7069 14.7286C36.7069 16.297 37.8492 17.4393 39.2127 17.4393C40.5579 17.4393 41.615 16.297 41.615 14.7286Z" fill="white" />
                                          <path d="M34.0187 14.7124C34.0187 17.3034 31.9918 19.2127 29.5042 19.2127C27.0167 19.2127 24.9897 17.3034 24.9897 14.7124C24.9897 12.1051 27.0167 10.2121 29.5042 10.2121C31.9918 10.2121 34.0187 12.1031 34.0187 14.7124ZM32.0425 14.7124C32.0425 13.0933 30.8677 11.9854 29.5042 11.9854C28.1408 11.9854 26.966 13.0933 26.966 14.7124C26.966 16.3153 28.1408 17.4393 29.5042 17.4393C30.8677 17.4393 32.0425 16.3133 32.0425 14.7124Z" fill="white" />
                                          <path d="M24.2792 14.7124C24.2792 17.3034 22.2523 19.2127 19.7647 19.2127C17.2772 19.2127 15.2502 17.3034 15.2502 14.7124C15.2502 12.1031 17.2772 10.2121 19.7647 10.2121C22.2523 10.2121 24.2792 12.1031 24.2792 14.7124ZM22.303 14.7124C22.303 13.0933 21.1282 11.9854 19.7647 11.9854C18.4013 11.9854 17.2265 13.0933 17.2265 14.7124C17.2265 16.3153 18.4013 17.4393 19.7647 17.4393C21.1282 17.4393 22.303 16.3133 22.303 14.7124Z" fill="white" />
                                          <path d="M53.9573 16.1933L55.4912 17.2159C54.9962 17.9484 53.8031 19.2104 51.7417 19.2104C49.1852 19.2104 47.2759 17.2342 47.2759 14.7101C47.2759 12.0339 49.2014 10.2098 51.5205 10.2098C53.8559 10.2098 54.9982 12.0684 55.3715 13.0727L55.5765 13.584L49.5605 16.0756C50.0211 16.9785 50.7373 17.4391 51.7417 17.4391C52.7481 17.4391 53.446 16.944 53.9573 16.1933ZM49.2359 14.5742L53.2573 12.9043C53.0362 12.3423 52.3707 11.9507 51.5875 11.9507C50.5831 11.9507 49.1852 12.8373 49.2359 14.5742Z" fill="white" />
                                          <path d="M46.4458 5.7482V18.9366H44.5183V5.7482H46.4458Z" fill="white" />
                                          <path d="M7.95395 13.5422V11.6329H14.3879C14.4508 11.9656 14.4832 12.3593 14.4832 12.7854C14.4832 14.2178 14.0916 15.9891 12.8296 17.2512C11.6021 18.5294 10.0337 19.2112 7.95597 19.2112C4.10496 19.2112 0.866699 16.0743 0.866699 12.2233C0.866699 8.37232 4.10496 5.2355 7.95597 5.2355C10.0864 5.2355 11.6041 6.07145 12.7444 7.16101L11.3971 8.50826C10.5795 7.7413 9.47163 7.14478 7.95395 7.14478C5.14177 7.14478 2.94235 9.41116 2.94235 12.2233C2.94235 15.0355 5.14177 17.3019 7.95395 17.3019C9.778 17.3019 10.8168 16.5694 11.4824 15.9039C12.0221 15.3642 12.3771 14.5932 12.5171 13.5401L7.95395 13.5422Z" fill="white" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row banner-search-padding vc_custom_1737871868290 vc_row-has-fill" style={{ position: "relative" }}>
                  <span className="careerfy-light-transparent" style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }} />
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-12">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="careerfy-thirteen-banner-caption float-left text-center">
                              <div className={"\x63ontainer"}>
                                <h1>Os profissionais que Transformam o Brasil</h1>
                                <br />
                                <h2>Rede</h2>
                                <div className="clearfix" />
                                <div className="careerfy-thirteen-banner-btn float-left"><a href="https://www.encontreum.com.br" rel="noopener" target="_blank">Encontre Um</a><a href="https://www.pingsolucoes.com/" rel="noopener" target="_blank">Ping Soluções</a><a href="https://www.precisodeumtecnico.com/" rel="noopener" target="_blank">Preciso de um Técnico</a><a href="https://www.tamonaweb.com.br/" rel="noopener" target="_blank">Tamo Na Web</a></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row vc_custom_1738614941257">
                  <div className="wpb_animate_when_almost_visible bounceInLeft wpb_column vc_column_container vc_col-sm-6 vc_col-has-fill wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "translate3d(0px, 0px, 0px)", opacity: "1" }}>
                    <div className="vc_column-inner vc_custom_1738496166554">
                      <div className="wpb_wrapper">
                        <div className="wpb_text_column wpb_content_element wpb_animate_when_almost_visible bounceInLeft vc_custom_1738616117277 wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "translate3d(0px, 0px, 0px)", opacity: "1" }}>
                          <div className="wpb_wrapper">
                            <h2 style={{ fontSize: "50px", fontWeight: "bold", color: "rgb(255, 255, 255)", textTransform: "uppercase", lineHeight: "1.2", textAlign: "center" }}>Sou Técnico</h2>
                            <p style={{ fontSize: "22px", color: "rgb(255, 255, 255)", textAlign: "center" }}>Quero ser encontrado!</p>
                          </div>
                        </div>
                        <div className="vc_btn3-container jobsearch-color vc_btn3-center vc_custom_1738615431084 vc_do_btn text-center [max-width:100%]" id="jobsearch-color jobsearch-open-register-tab">
                          <button className="vc_general vc_btn3 vc_btn3-size-lg vc_btn3-shape-round vc_btn3-style-custom text-center align-middle" style={{ backgroundColor: "rgb(255, 255, 255)", color: "rgb(51, 51, 51)" }}>Quero ser encontrado!</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="wpb_column vc_column_container vc_col-sm-6 vc_col-has-fill">
                    <div className="vc_column-inner vc_custom_1564727065800">
                      <div className="wpb_wrapper">
                        <div className="wpb_text_column wpb_content_element wpb_animate_when_almost_visible bounceInRight vc_custom_1738616154364 wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "translate3d(0px, 0px, 0px)", opacity: "1" }}>
                          <div className="wpb_wrapper">
                            <h2 style={{ fontSize: "50px", fontWeight: "bold", color: "rgb(255, 255, 255)", textTransform: "uppercase", lineHeight: "1.1", textAlign: "center" }}>Sou Cliente</h2>
                            <p style={{ fontSize: "22px", color: "rgb(255, 255, 255)", textAlign: "center" }}>Quero encontrar um técnico</p>
                          </div>
                        </div>
                        <div className="vc_btn3-container vc_btn3-center vc_custom_1738615541572 vc_do_btn text-center [max-width:100%]">
                          <a className="vc_general vc_btn3 vc_btn3-size-lg vc_btn3-shape-round vc_btn3-style-custom text-center align-middle" style={{ backgroundColor: "rgb(255, 255, 255)", color: "rgb(51, 51, 51)" }} href="/publicar-nova-atividade" title="">Quero encontrar um técnico</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row vc_custom_1737945571946">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-12">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <section className="careerfy-fancy-title float-left text-center">
                              <h2>Categorias de atividades populares</h2>
                              <p>Uma carreira melhor está lá fora. Vamos ajudá -lo a encontrá -lo. Somos seu primeiro passo para se tornar tudo o que você quer ser.</p>
                            </section>
                            <div className="categories-list" id="jobsearch-findby-sectors">
                              <ul className="jobsearch-sects-allcon row">
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/ar-condicionado-atividades">{"\n"}<img decoding="async" />{"\n"}<span className="jobcat-title">Ar condicionado</span>{"\n"}<span id="jobsearchh-sect-cat-item-52">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/automacao-atividades">{"\n"}<i className="careerfy-icon careerfy-stopwatch" /><span className="jobcat-title">Automação</span>{"\n"}<span id="jobsearchh-sect-cat-item-69">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/cftv-atividades">{"\n"}<img decoding="async" />{"\n"}<span className="jobcat-title">CFTV</span>{"\n"}<span id="jobsearchh-sect-cat-item-56">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/computador-atividades">{"\n"}<img decoding="async" />{"\n"}<span className="jobcat-title">Computador</span>{"\n"}<span id="jobsearchh-sect-cat-item-57">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/comunicacoes-atividades">{"\n"}<i className="careerfy-icon careerfy-target" /><span className="jobcat-title">Comunicações</span>{"\n"}<span id="jobsearchh-sect-cat-item-37">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/eletrica-atividades">{"\n"}<i className="careerfy-icon careerfy-skills" /><span className="jobcat-title">Elétrica</span>{"\n"}<span id="jobsearchh-sect-cat-item-58">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/grafica-atividades">{"\n"}<img decoding="async" />{"\n"}<span className="jobcat-title">Gráfica</span>{"\n"}<span id="jobsearchh-sect-cat-item-59">(0 Vagas)</span></a>
                                </li>
                                <li className={"\x63ol-md-3 text-center"}>
                                  <a href="/impressora-atividades">{"\n"}<img decoding="async" />{"\n"}<span className="jobcat-title">Impressora</span>{"\n"}<span id="jobsearchh-sect-cat-item-60">(0 Vagas)</span></a>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row">
                  <div className="wpb_animate_when_almost_visible slideInUp wpb_column vc_column_container vc_col-sm-12 vc_col-has-fill vc_general vc_parallax wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "translate3d(0px, 0px, 0px)", visibility: "visible" }}>
                    <div className="vc_column-inner">
                      <div className="wpb_wrapper">
                        <div style={{ position: "relative", float: "left", width: "100%", height: "auto" }} id="careerfy-slidmaintop-6691310">
                          <div className="careerfy-banner-nine slick-initialized slick-slider float-left [touch-action:pan-y]" data-site-import-desktop-variant="">
                            <div className={"slick-list [&:focus]:[outline:none]"}>
                              <div className="slick-track" style={{ opacity: "1", width: "4563px" }}>
                                <div className="careerfy-bannernine-layer slick-slide [min-height:1px]" style={{ display: "inline-block", width: "1521px", position: "relative", left: "0px", top: "0px", zIndex: "998", opacity: "0", transition: "opacity 500ms" }} tabIndex={-1} data-site-import-responsive="617" aria-hidden="true">
                                  <div className="careerfy-bannernine-caption [@media(max-width:767px)]:float-left [@media(min-width:768px)_and_(max-width:990px)]:float-left [@media(min-width:990px)_and_(max-width:1150px)]:float-left">
                                    <div className={"\x63ontainer"}>
                                      <div className="careerfy-bannernine-caption-inner">
                                        <span>Precisa de um Técnico?</span>
                                        <h1>Junte-se à maior plataforma de técnicos do Brasil! 🚀</h1>
                                        <h2>Precisou? Encontrou!</h2>
                                        <p>Somos a melhor plataforma para contratação de técnicos em todo o país!</p>
                                        <a style={{ backgroundColor: "rgb(48, 71, 165)", color: "rgb(255, 255, 255)" }} href="#" tabIndex={-1}>Pesquisar Técnicos</a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="careerfy-bannernine-thumb float-right">
                                    <img decoding="async" src="/site-assets/a78f7ac3c532a62f.jpg" alt="" />
                                  </div>
                                </div>
                                <div className="careerfy-bannernine-layer slick-slide [min-height:1px]" style={{ display: "inline-block", width: "1521px", position: "relative", left: "-1521px", top: "0px", zIndex: "998", opacity: "0", transition: "opacity 500ms" }} tabIndex={-1} data-site-import-responsive="628" aria-hidden="true">
                                  <div className="careerfy-bannernine-caption [@media(max-width:767px)]:float-left [@media(min-width:768px)_and_(max-width:990px)]:float-left [@media(min-width:990px)_and_(max-width:1150px)]:float-left">
                                    <div className={"\x63ontainer"}>
                                      <div className="careerfy-bannernine-caption-inner">
                                        <span>Técnicos e Prestadores</span>
                                        <h1>A melhor maneira de encontrar um técnico</h1>
                                        <h2>Atividades</h2>
                                        <p>Publique uma atividade ou projeto e obtenha uma pequena lista de técnicos e profissionais de verificados e experientes.</p>
                                        <a style={{ backgroundColor: "rgb(48, 71, 165)", color: "rgb(255, 255, 255)" }} href="#" tabIndex={-1}>Buscar atividade</a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="careerfy-bannernine-thumb float-right">
                                    <img decoding="async" src="/site-assets/a78f7ac3c532a62f.jpg" alt="" />
                                  </div>
                                </div>
                                <div className="careerfy-bannernine-layer slick-slide slick-current slick-active [min-height:1px]" style={{ display: "inline-block", width: "1521px", position: "relative", left: "-3042px", top: "0px", zIndex: "999", opacity: "1" }} tabIndex={0} data-site-import-responsive="208" aria-hidden="false">
                                  <div className="careerfy-bannernine-caption [@media(max-width:767px)]:float-left [@media(min-width:768px)_and_(max-width:990px)]:float-left [@media(min-width:990px)_and_(max-width:1150px)]:float-left">
                                    <div className={"\x63ontainer"}>
                                      <div className="careerfy-bannernine-caption-inner">
                                        <span>Precisa de um Técnico?</span>
                                        <h1>Uma maneira melhor de encontrar e contratar profissionais</h1>
                                        <h2>Encontre um!</h2>
                                        <p>Clientes confiantes, desafios resolvidos com excelência.</p>
                                        <a style={{ backgroundColor: "rgb(48, 71, 165)", color: "rgb(255, 255, 255)" }} href="#" tabIndex={0}>Pesquisar Técncos</a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="careerfy-bannernine-thumb float-right">
                                    <img decoding="async" src="/site-assets/a78f7ac3c532a62f.jpg" alt="" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="careerfy-banner-nine slick-initialized slick-slider float-left [touch-action:pan-y]" style={{ "--site-import-responsive-display": "block" } as CSSProperties} data-site-import-mobile-variant="">
                            <div className={"slick-list [&:focus]:[outline:none]"}>
                              <div className="slick-track" style={{ opacity: "1", width: "1080px" }}>
                                <div className="careerfy-bannernine-layer slick-slide [min-height:1px]" style={{ display: "inline-block", width: "360px", position: "relative", left: "0px", top: "0px", zIndex: "998", opacity: "0" }} tabIndex={-1} aria-hidden="true">
                                  <div className="careerfy-bannernine-caption [@media(max-width:767px)]:float-left [@media(min-width:768px)_and_(max-width:990px)]:float-left [@media(min-width:990px)_and_(max-width:1150px)]:float-left">
                                    <div className={"\x63ontainer"}>
                                      <div className="careerfy-bannernine-caption-inner">
                                        <span>Precisa de um Técnico?</span>
                                        <h1>Junte-se à maior plataforma de técnicos do Brasil! 🚀</h1>
                                        <h2>Precisou? Encontrou!</h2>
                                        <p>Somos a melhor plataforma para contratação de técnicos em todo o país!</p>
                                        <a style={{ backgroundColor: "rgb(48, 71, 165)", color: "rgb(255, 255, 255)" }} href="#" tabIndex={-1}>Pesquisar Técnicos</a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="careerfy-bannernine-thumb float-right">
                                    <img decoding="async" src="/site-assets/a78f7ac3c532a62f.jpg" alt="" />
                                  </div>
                                </div>
                                <div className="careerfy-bannernine-layer slick-slide [min-height:1px]" style={{ display: "inline-block", width: "360px", position: "relative", left: "-360px", top: "0px", zIndex: "998", opacity: "0" }} tabIndex={-1} aria-hidden="true">
                                  <div className="careerfy-bannernine-caption [@media(max-width:767px)]:float-left [@media(min-width:768px)_and_(max-width:990px)]:float-left [@media(min-width:990px)_and_(max-width:1150px)]:float-left">
                                    <div className={"\x63ontainer"}>
                                      <div className="careerfy-bannernine-caption-inner">
                                        <span>Técnicos e Prestadores</span>
                                        <h1>A melhor maneira de encontrar um técnico</h1>
                                        <h2>Atividades</h2>
                                        <p>Publique uma atividade ou projeto e obtenha uma pequena lista de técnicos e profissionais de verificados e experientes.</p>
                                        <a style={{ backgroundColor: "rgb(48, 71, 165)", color: "rgb(255, 255, 255)" }} href="#" tabIndex={-1}>Buscar atividade</a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="careerfy-bannernine-thumb float-right">
                                    <img decoding="async" src="/site-assets/a78f7ac3c532a62f.jpg" alt="" />
                                  </div>
                                </div>
                                <div className="careerfy-bannernine-layer slick-slide slick-current slick-active [min-height:1px]" style={{ display: "inline-block", width: "360px", position: "relative", left: "-720px", top: "0px", zIndex: "999", opacity: "1" }} tabIndex={0} aria-hidden="false">
                                  <div className="careerfy-bannernine-caption [@media(max-width:767px)]:float-left [@media(min-width:768px)_and_(max-width:990px)]:float-left [@media(min-width:990px)_and_(max-width:1150px)]:float-left">
                                    <div className={"\x63ontainer"}>
                                      <div className="careerfy-bannernine-caption-inner">
                                        <span>Precisa de um Técnico?</span>
                                        <h1>Uma maneira melhor de encontrar e contratar profissionais</h1>
                                        <h2>Encontre um!</h2>
                                        <p>Clientes confiantes, desafios resolvidos com excelência.</p>
                                        <a style={{ backgroundColor: "rgb(48, 71, 165)", color: "rgb(255, 255, 255)" }} href="#" tabIndex={0}>Pesquisar Técncos</a>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="careerfy-bannernine-thumb float-right">
                                    <img decoding="async" src="/site-assets/a78f7ac3c532a62f.jpg" alt="" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="vc_parallax-inner [right:0px]" style={{ height: "150%", top: "-50%" }} />
                  </div>
                </div>
                <div className="vc_row wpb_row vc_custom_1737945560076 vc_row-has-fill">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-8">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="wpb_text_column wpb_content_element wpb_animate_when_almost_visible fadeInUpBig wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "translate3d(0px, 0px, 0px)", opacity: "1" }}>
                              <div className="wpb_wrapper">
                                <div>
                                  <div className="elementor-widget-container">
                                    <h2 className="elementor-heading-title">Faça parte da melhor rede de técnicos de TI do Brasil</h2>
                                  </div>
                                </div>
                                <div>
                                  <div className="elementor-widget-container">
                                    <p>Torne-se um parceiro Preciso de um Técnico e aproveite uma oportunidade flexível de ganhos de acordo com a sua disponibilidade.</p>
                                  </div>
                                </div>
                                <div>
                                  <div className="elementor-widget-container">
                                    <h3>
                                      <strong>De acordo com sua localização</strong>
                                    </h3>
                                    <p>A demanda chega de acordo com a sua localidade, facilitando o dia a dia para você e o cliente.</p>
                                    <p>Oportunidade de networking</p>
                                    <div>
                                      <div className="elementor-widget-container">
                                        <div>
                                          <div>
                                            <div>
                                              <p>Os atendimentos são realizados em grandes empresas de diferentes setores, gerando experiência em serviços consolidados para você obter mais expertise na sua área e ter contato com novos nichos de mercado.</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="elementor-widget-container">
                                        <div>
                                          <div>
                                            <div>
                                              <h3>Parceiro: <strong>Preciso de um Técnico</strong></h3>
                                              <p>Como nosso parceiro, você é integrado ao Ecossistema Ping Soluções e TamoNaWeb, que contempla uma série de soluções tecnológicas que expandem as modalidades e possibilidades de atendimento.</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="wpb_column vc_column_container vc_col-sm-4">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="row">
                              <aside className={"\x63ol-md-6 careerfy-typo-wrap"}>
                                <div className="careerfy-parallex-text careerfy-logo-text float-left">
                                  <h2 />
                                </div>
                              </aside>
                              <aside className={"\x63ol-md-6 careerfy-typo-wrap"}>
                                <div className="careerfy-logo-thumb float-right">
                                  <img decoding="async" src="/site-assets/6da2fd065724284e.webp" alt="" />
                                </div>
                              </aside>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-12">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="wpb_text_column wpb_content_element">
                              <div className="wpb_wrapper" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row vc_custom_1553759438012 vc_row-has-fill">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-8">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="wpb_text_column wpb_content_element wpb_animate_when_almost_visible zoomIn vc_custom_1737745889718 wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "scale3d(1, 1, 1)", opacity: "1" }}>
                              <div className="wpb_wrapper">
                                <h2>
                                  <span style={{ fontSize: "20px", color: "rgb(255, 255, 255)", fontWeight: "300" }}>Preciso de um Técnico, ajuda você a encontrar um técnico!</span>
                                </h2>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="wpb_column vc_column_container vc_col-sm-4">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="vc_btn3-container wpb_animate_when_almost_visible flipInX vc_do_btn wpb_start_animation animated text-right [max-width:100%] [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "perspective(400px) rotateX(0deg)", opacity: "1" }}>
                              <a className="vc_general vc_btn3 vc_btn3-size-md vc_btn3-shape-round vc_btn3-style-custom text-center align-middle" style={{ backgroundColor: "rgb(255, 255, 255)", color: "rgb(48, 71, 165)" }} href="#" target="_blank" title="">Encontrar um prestador</a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <ImportedSectionProcessoQueAjudamA />
                <div className="vc_row wpb_row">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-12">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper">
                            <div className="wpb_text_column wpb_content_element">
                              <div className="wpb_wrapper">
                                <div style={{ transform: "translate(1255px, 7px)" }} id="mttContainer" aria-expanded="false" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="vc_row wpb_row">
                  <div className={"\x63ontainer"}>
                    <div className="row">
                      <div className="wpb_column vc_column_container vc_col-sm-12">
                        <div className="vc_column-inner">
                          <div className="wpb_wrapper" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <ImportedFooterJob />
        <div className="clearfix" />
      </div>
      <div className="jobsearch-modal fade [outline:0px] [transition:opacity_0.15s_linear]" id="JobSearchModalApplyJobWarning">
        <div className="modal-inner-area"> </div>
        <div className="modal-content-area items-center max-w-[600px] min-h-[calc(100%_-_1rem)] [-webkit-box-align:center]">
          <div className="modal-box-area flex-col [-webkit-box-direction:normal] [-webkit-box-orient:vertical] [outline:0px] [transition:0.6s_ease-in-out]">
            <span className="modal-close float-right [cursor:pointer] [transition:0.4s_ease-in-out]">
              <i className="fa fa-times float-right [text-rendering:auto]" />
            </span>
            <div className="jobsearch-send-message-form">
              <div><span>É necessário fazer login como "Técnico" para se candidatar a esta atividade. </span><span>Clique aqui para <a href={"/wp-loginphp-df475dccbaf24845?action=logout&redirect_to=https%3A%2F%2Fencontreumtecnico.com%2F&_wpnonce=a8a68b61b8"}>Sair </a>{" "}</span><span>E tente novamente </span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="jobsearch-modal jobsearch-typo-wrap fade [outline:0px] [transition:opacity_0.15s_linear]" id="JobSearchModalLogin">
        <div className="modal-inner-area"> </div>
        <div className="modal-content-area items-center max-w-[600px] min-h-[calc(100%_-_1rem)] [-webkit-box-align:center]">
          <div className="modal-box-area flex-col [-webkit-box-direction:normal] [-webkit-box-orient:vertical] [outline:0px] [transition:0.6s_ease-in-out]">
            <div>
              <div className="jobsearch-modal-title-box float-left">
                <h2>Entre na sua conta</h2>
                <span className="modal-close float-right [cursor:pointer] [transition:0.4s_ease-in-out]">
                  <i className="fa fa-times float-right [text-rendering:auto]" />
                </span>
              </div>
              <form autoComplete="off" id="login-form-9013995" method="post">
                <div className="jobsearch-user-form">
                  <ul>
                    <li><label>Digite o endereço de e-mail:</label><input className="required" name="pt_user_login" type="text" placeholder="Digite o endereço de e-mail" /><i className="jobsearch-icon jobsearch-user bottom-[11px] right-[29px]" /></li>
                    <li><label>Senha:</label><input className="required" name="pt_user_pass" type="password" placeholder="Digite a senha" /><i className="jobsearch-icon jobsearch-multimedia bottom-[11px] right-[29px]" /><a className="jobsearch-user-showpass" style={{ display: "none" }} href="#"><i className="jobsearch-icon jobsearch-view bottom-[11px] right-[29px]" /></a></li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap"><input type="hidden" name="action" defaultValue="jobsearch_login_member_submit" /><input type="hidden" name="current_page_id" defaultValue="2336" /><input className="jobsearch-login-submit-btn text-center" type="submit" value="Entrar" /><div className="form-loader" /><div className="jobsearch-user-form-info"><p><a className="lost-password">Esqueceu sua senha?</a> |
      <a className="register-form">Inscrever-se</a></p><div className="jobsearch-checkbox"><input type="checkbox" id="r-9013995" name="remember_password" /><label htmlFor="r-9013995"><span /> Salvar senha                                    </label></div></div></li>
                  </ul>
                  <div className="login-reg-errors" />
                  <div id="jobsearch-aterreg-9356662">
                    <input type="hidden" name="register-security" defaultValue="ebea0853bd" />
                    <input type="hidden" name="_wp_http_referer" defaultValue="/wp-admin/admin-ajax.php" />
                  </div>
                </div>
                <div className="jobsearch-box-title jobsearch-box-title-sub float-left text-center">
                  <span>Ou faça login com</span>
                </div>
                <div className="clearfix" />
                <ul className="jobsearch-login-media [@media(max-width:767px)]:justify-center">
                  <li>
                    <a className="jobsearch-google-plus-bg items-center text-center [@media(max-width:767px)]:max-h-[50px] [@media(max-width:767px)]:[text-indent:-9999px]" data-original-title="google" href={"https://accounts.google.com/o/oauth2/auth?response_type=code&redirect_uri=https%3A%2F%2Fencontreumtecnico.com%2F&client_id=844790792187-mb158k2u8vmcbtlc9r25vg3qpclkgu9u.apps.googleusercontent.com&scope=email+profile&access_type=online&approval_prompt=auto"}><div className="jobsearch-google-svg [text-indent:0px] [@media(max-width:767px)]:[text-indent:0px]"><div /></div>Entrar com o Google</a>
                  </li>
                </ul>
              </form>
            </div>
            <div className="jobsearch-reset-password" style={{ display: "none" }}>
              <div className="jobsearch-modal-title-box float-left">
                <h2>Redefinir senha</h2>
                <span className="modal-close float-right [cursor:pointer] [transition:0.4s_ease-in-out]">
                  <i className="fa fa-times float-right [text-rendering:auto]" />
                </span>
              </div>
              <form autoComplete="off" id="reset-password-form-9013995" method="post">
                <div className="jobsearch-user-form">
                  <ul>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap"><label>Digite o endereço de e-mail:</label><input className="required" id="pt_user_or_email_9013995" name="pt_user_or_email" type="text" placeholder="Digite o nome de usuário ou endereço de e-mail para redefinir a senha" /><i className="jobsearch-icon jobsearch-mail bottom-[11px] right-[29px]" /></li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap"><input type="hidden" name="action" defaultValue="jobsearch_reset_password" /><input className="jobsearch-reset-password-submit-btn text-center" type="submit" value="Obter uma nova senha" /><div className="form-loader" /><div className="jobsearch-user-form-info"><p><a>Já tem uma conta? Entrar</a></p></div></li>
                  </ul>
                  <p>Insira o nome de usuário ou e-mail que você usou em seu perfil. Um link de redefinição de senha será enviado a você por e-mail.</p>
                  <div className="reset-password-errors" />
                  <div id="jobsearch-aterreg-2707065">
                    <input type="hidden" name="register-security" defaultValue="ebea0853bd" />
                    <input type="hidden" name="_wp_http_referer" defaultValue="/wp-admin/admin-ajax.php" />
                  </div>
                </div>
              </form>
            </div>
            <div className="jobsearch-register-form" style={{ display: "none" }}>
              <div className="jobsearch-modal-title-box float-left">
                <h2>Inscreva-se na sua conta</h2>
                <span className="modal-close float-right [cursor:pointer] [transition:0.4s_ease-in-out]">
                  <i className="fa fa-times float-right [text-rendering:auto]" />
                </span>
              </div>
              <form autoComplete="off" id="registration-form-9013995" method="POST" encType="multipart/form-data">
                <div className="jobsearch-box-title float-left text-center"><span>Escolha o seu tipo de conta</span><input type="hidden" name="pt_user_role" defaultValue="jobsearch_candidate" /></div>
                <div className="jobsearch-user-options float-left">
                  <ul className="float-left">
                    <li className="active">
                      <a className="float-left">{"\n"}<i className="jobsearch-icon jobsearch-user" />{"\n"}<span>Técnico</span>{"\n"}<small>Quero descobrir empresas incríveis.</small>{"\n"}</a>
                    </li>
                    <li>
                      <a className="float-left">{"\n"}<i className="jobsearch-icon jobsearch-building" />{"\n"}<span>Cliente</span>{"\n"}<small>Quero atrair os melhores talentos.</small>{"\n"}</a>
                    </li>
                  </ul>
                </div>
                <div className="jobsearch-user-form jobsearch-user-form-coltwo">
                  <ul>
                    <li><label>Primeiro nome *</label>                                    <input name="pt_user_fname" type="text" placeholder="Digite o primeiro nome" required /><i className="jobsearch-icon jobsearch-user bottom-[11px] right-[29px]" /></li>
                    <li><label>Sobrenome *</label>                                    <input name="pt_user_lname" type="text" placeholder="Digite o sobrenome" required /><i className="jobsearch-icon jobsearch-user bottom-[11px] right-[29px]" /></li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap"><label>E-mail *</label>                                <input name="pt_user_email" id="pt_user_email_9013995" type="email" placeholder="Digite o e-mail" /><i className="jobsearch-icon jobsearch-mail bottom-[11px] right-[29px]" /></li>
                    <li><label>Senha *</label>                                    <input className="jobsearch_chk_passfield" name="pt_user_pass" id="pt_user_pass_9013995" type="password" placeholder="Digite a senha" /><span className="passlenth-chk-msg [transition:0.4s_ease-in-out]" style={{ display: "none" }} /><i className="jobsearch-icon jobsearch-multimedia bottom-[11px] right-[29px]" /><a className="jobsearch-user-showpass" style={{ display: "none" }} href="#"><i className="jobsearch-icon jobsearch-view bottom-[11px] right-[29px]" /></a></li>
                    <li><label>Confirme sua senha *</label>                                    <input className="required" name="pt_user_cpass" id="pt_user_cpass_9013995" type="password" placeholder="Digite Confirmar Senha" /><i className="jobsearch-icon jobsearch-multimedia bottom-[11px] right-[29px]" /><a className="jobsearch-user-showpass" style={{ display: "none" }} href="#"><i className="jobsearch-icon jobsearch-view bottom-[11px] right-[29px]" /></a></li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap">
                      <label>Telefone:</label>
                      <div className="phon-num-fieldcon phonefild-wout-valid" id="phon-fieldcon-9013995"><input className="required" name="pt_user_phone" id="pt_user_phone_9013995" type="tel" placeholder="Número de telefone " /><input id="dial_code_9013995" type="hidden" name="dial_code" /><input id="contry_code_9013995" type="hidden" name="contry_iso_code" /></div>
                      <i className="jobsearch-icon jobsearch-technology bottom-[11px] right-[29px]" />
                    </li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap" style={{ display: "none" }}><label>Nome da organização</label>                                    <input className="required" name="pt_user_organization" id="pt_user_organization_9013995" type="text" placeholder="Insira o nome da organização" /><i className="jobsearch-icon jobsearch-briefcase bottom-[11px] right-[29px]" /></li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap">
                      <label>Selecione Setores</label>
                      <div className="jobsearch-profile-select float-left">
                        <select className="appearance-none [cursor:pointer]" style={{ display: "none" }} id="pt_user_category_9013995" name="pt_user_category[]" multiple tabIndex={-1} {...({ placeholder: "Selecione os setores" } as any)} />
                        <div className="selectize-control multi plugin-remove_button">
                          <div className="selectize-input items min-h-[41px]">
                            <input style={{ width: "114.516px" }} type="text" autoComplete="off" {...({ tabIndex: "" } as any)} id="pt_user_category_9013995-selectized" placeholder="Selecione os setores" />
                          </div>
                          <div className="selectize-dropdown multi plugin-remove_button text-left" style={{ display: "none", width: "0px", top: "0px", left: "0px" }}>
                            <div className="selectize-dropdown-content max-h-[200px]" />
                          </div>
                        </div>
                      </div>
                    </li>
                    <li style={{ display: "inline-block" }}><label>Seu Whatsapp*</label><input type="number" name="whatsapp" className="" placeholder="Seu Whatsapp" required defaultValue="" /></li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap">
                      <div className="recaptcha-reload" id="recaptcha_popup_div">
                        <div id="recaptcha_popup">
                          <div style={{ width: "304px", height: "78px" }}>
                            <div />
                            <textarea style={{ width: "250px", height: "40px", border: "1px solid rgb(193, 193, 193)", margin: "10px 25px", padding: "0px", resize: "none", display: "none" }} id="g-recaptcha-response-1" name="g-recaptcha-response" />
                          </div>
                        </div>
                        <a className="recaptcha-reload-a"><i className="fa fa-refresh [text-rendering:auto]" /> Recarregar</a>
                      </div>
                    </li>
                    <li className="jobsearch-user-form-coltwo-full items-center justify-between [@media(max-width:767px)]:flex-wrap"><div className="terms-priv-chek-con flex-wrap"><p><input type="checkbox" name="terms_cond_check" /><span>
      Ao clicar na caixa de seleção, você concorda com nossos <a href="/termos-e-condicoes" target="_blank">Termos e Condições</a> e <a href="/politica-de-privacidade" target="_blank">Política de Privacidade</a>{"                        "}</span></p></div><input type="hidden" name="action" defaultValue="jobsearch_register_member_submit" /><input className="jobsearch-register-submit-btn jobsearch-disable-btn text-center" disabled type="submit" value="Inscrever-se" /><div className="form-loader" /><div className="jobsearch-user-form-info"><p><a>Já tem uma conta? Entrar</a></p></div></li>
                  </ul>
                  <div className="clearfix" />
                  <div className="registration-errors" />
                  <div id="jobsearch-aterreg-8480760">
                    <input type="hidden" name="register-security" defaultValue="ebea0853bd" />
                    <input type="hidden" name="_wp_http_referer" defaultValue="/wp-admin/admin-ajax.php" />
                  </div>
                </div>
                <div className="jobsearch-box-title jobsearch-box-title-sub float-left text-center">
                  <span>Ou faça login com</span>
                </div>
                <div className="clearfix" />
                <ul className="jobsearch-login-media [@media(max-width:767px)]:justify-center">
                  <li>
                    <a className="jobsearch-google-plus-bg items-center text-center [@media(max-width:767px)]:max-h-[50px] [@media(max-width:767px)]:[text-indent:-9999px]" data-original-title="google" href={"https://accounts.google.com/o/oauth2/auth?response_type=code&redirect_uri=https%3A%2F%2Fencontreumtecnico.com%2F&client_id=844790792187-mb158k2u8vmcbtlc9r25vg3qpclkgu9u.apps.googleusercontent.com&scope=email+profile&access_type=online&approval_prompt=auto"}><div className="jobsearch-google-svg [text-indent:0px] [@media(max-width:767px)]:[text-indent:0px]"><div /></div>Entrar com o Google</a>
                  </li>
                </ul>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="jobsearch-quick-apply-box right-[-100%]" style={{ display: "none" }}>
        <div id="jobsearch-loader" />
        <a className="jobsearch-quick-apply-close float-left text-center"><i className="fa fa-times [text-rendering:auto]" />Close</a>
      </div>
      <div className="jobsearch-modal fade [outline:0px] [transition:opacity_0.15s_linear]" id="JobSearchModalApplyJobQuests">
        <div className="modal-inner-area"> </div>
        <div className="modal-content-area items-center max-w-[600px] min-h-[calc(100%_-_1rem)] [-webkit-box-align:center]">
          <div className="modal-box-area flex-col [-webkit-box-direction:normal] [-webkit-box-orient:vertical] [outline:0px] [transition:0.6s_ease-in-out]">
            <div className="jobsearch-modal-title-box float-left">
              <h2>Respostas</h2>
              <span className="modal-close float-right [cursor:pointer] [transition:0.4s_ease-in-out]">
                <i className="fa fa-times float-right [text-rendering:auto]" />
              </span>
            </div>
            <div className="jobsearch-applyjobans-con" />
          </div>
        </div>
      </div>
      <div className="jobsearch-modal fade [outline:0px] [transition:opacity_0.15s_linear]" id="JobSearchModalAccountActivationForm">
        <div className="modal-inner-area"> </div>
        <div className="modal-content-area items-center max-w-[600px] min-h-[calc(100%_-_1rem)] [-webkit-box-align:center]">
          <div className="modal-box-area flex-col [-webkit-box-direction:normal] [-webkit-box-orient:vertical] [outline:0px] [transition:0.6s_ease-in-out]">
            <div className="jobsearch-modal-title-box float-left">
              <h2>Ativação de conta</h2>
              <span className="modal-close float-right [cursor:pointer] [transition:0.4s_ease-in-out]">
                <i className="fa fa-times float-right [text-rendering:auto]" />
              </span>
            </div>
            <div className="jobsearch-send-message-form">
              <form autoComplete="off" method="post" id="jobsearch_uaccont_aprov_form">
                <div className="jobsearch-user-form">
                  <p>Antes de poder fazer login, você deve ativar sua conta com o código enviado para seu endereço de e-mail. Se você não recebeu este e-mail, verifique sua pasta de lixo eletrônico/spam. <a className="jobsearch-resend-accactbtn" style={{ color: "rgb(0, 0, 0)" }}>Clique aqui</a> para reenviar o e-mail de ativação. Se você inseriu um endereço de e-mail incorreto, precisará registrar-se novamente com o endereço de e-mail correto.</p>
                  <ul>
                    <li>
                      <label>
      Seu e-mail:
      </label>
                      <div>
                        <input type="text" name="user_email" />
                      </div>
                    </li>
                    <li>
                      <label>
      Código de ativação:
      </label>
                      <div>
                        <input type="text" name="activ_code" />
                      </div>
                    </li>
                    <li>
                      <div className="input-field-submit"><input className="text-center" type="submit" value="Ativar conta" /><span /></div>
                    </li>
                  </ul>
                  <div style={{ display: "none", float: "left", width: "100%", margin: "10px 0px 0px" }} />
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "static" }} id="addtoany">
        <div style={{ height: "1px", width: "1px", position: "absolute", zIndex: "100000", top: "0px", visibility: "hidden" }} />
      </div>
      <div style={{ backgroundColor: "rgb(255, 255, 255)", border: "1px solid rgb(204, 204, 204)", boxShadow: "rgba(0, 0, 0, 0.2) 2px 2px 3px", position: "absolute", transition: "visibility 0.3s linear, opacity 0.3s linear", opacity: "0", visibility: "hidden", zIndex: "2000000000", left: "0px", top: "-10000px" } as CSSProperties} data-site-import-responsive="938">
        <div style={{ width: "100%", height: "100%", position: "fixed", top: "0px", left: "0px", zIndex: "2000000000", backgroundColor: "rgb(255, 255, 255)", opacity: "0.05" }} />
        <div style={{ border: "11px solid transparent", width: "0px", height: "0px", position: "absolute", pointerEvents: "none", marginTop: "-11px", zIndex: "2000000000" }} />
        <div style={{ border: "10px solid transparent", width: "0px", height: "0px", position: "absolute", pointerEvents: "none", marginTop: "-10px", zIndex: "2000000000" }} />
        <div style={{ zIndex: "2000000000", position: "relative" }} />
      </div>
      <div style={{ backgroundColor: "rgb(255, 255, 255)", border: "1px solid rgb(204, 204, 204)", boxShadow: "rgba(0, 0, 0, 0.2) 2px 2px 3px", position: "absolute", transition: "visibility 0.3s linear, opacity 0.3s linear", opacity: "0", visibility: "hidden", zIndex: "2000000000", left: "0px", top: "-10000px" } as CSSProperties} data-site-import-responsive="944">
        <div style={{ width: "100%", height: "100%", position: "fixed", top: "0px", left: "0px", zIndex: "2000000000", backgroundColor: "rgb(255, 255, 255)", opacity: "0.05" }} />
        <div style={{ border: "11px solid transparent", width: "0px", height: "0px", position: "absolute", pointerEvents: "none", marginTop: "-11px", zIndex: "2000000000" }} />
        <div style={{ border: "10px solid transparent", width: "0px", height: "0px", position: "absolute", pointerEvents: "none", marginTop: "-10px", zIndex: "2000000000" }} />
        <div style={{ zIndex: "2000000000", position: "relative" }} />
      </div>
    </>
  );
}

function ImportedHeader() {
  return (
    <header className="careerfy-header-one float-left" id="careerfy-header">
      <div className={"\x63ontainer"}>
        <div className="row">
          <div className="header-tabel">
            <div className="header-row">
              <div className="careerfy-logo-con align-middle">
                <a className="careerfy-logo align-middle" href="/" title="Encontre um técnico | Preciso de um técnico">
                  <img src="/site-assets/99bf6851eea67efa.webp" width="260" height="39" alt="Encontre um técnico | Preciso de um técnico" />
                </a>
                <div className="navigation-sub align-middle [@media_screen_and_(min-width:991px)_and_(max-width:1054px)]:float-left">
                  <a className="menu-link active" href="#menu">
                    <span />
                  </a>
                  <nav className="careerfy-navigation navbar navbar-default menu text-left [min-height:auto]" id="menu">
                    <ul className="nav navbar-nav list-none [@media(min-width:768px)]:float-left" id="menu-main-menu">
                      <li className="submenu-addicon" id="menu-item-322">
                        <a href="/lista-de-clientes">Cliente</a>
                        <ul className="sub-menu">
                          <li id="menu-item-350">
                            <a href="/publicar-nova-atividade">Preciso de um técnico</a>
                          </li>
                        </ul>
                        <span className="has-subnav text-center [cursor:pointer]">
                          <i className="fa fa-angle-down [text-rendering:auto]" />
                        </span>
                      </li>
                      <li className="submenu-addicon" id="menu-item-3040">
                        <a href={"/lista-de-tecnicos?ajax_filter=true&sort-by=recent&posted=all"}>Listas de técnicos e prestadores</a>
                        <ul className="sub-menu">
                          <li id="menu-item-3001">
                            <a href="/o-que-e-field-service">O que é Field Service?</a>
                          </li>
                          <li id="menu-item-323" />
                        </ul>
                        <span className="has-subnav text-center [cursor:pointer]">
                          <i className="fa fa-angle-down [text-rendering:auto]" />
                        </span>
                      </li>
                      <li className="submenu-addicon" id="menu-item-318">
                        <a href="/?page_id=178">Sobre nós</a>
                        <ul className="sub-menu">
                          <li id="menu-item-3002">
                            <a href="/como-funciona">Como Funciona</a>
                          </li>
                          <li id="menu-item-747">
                            <a href="/termos-e-condicoes">Termos e Condições</a>
                          </li>
                          <li id="menu-item-355">
                            <a href="/faqs">FAQ’S</a>
                          </li>
                        </ul>
                        <span className="has-subnav text-center [cursor:pointer]">
                          <i className="fa fa-angle-down [text-rendering:auto]" />
                        </span>
                      </li>
                      <li className="submenu-addicon" id="menu-item-344">
                        <a href="/news">News</a>
                        <ul className="sub-menu">
                          <li id="menu-item-754">
                            <a href="https://old.encontreumtecnico.com/">Site de 2024</a>
                          </li>
                        </ul>
                        <span className="has-subnav text-center [cursor:pointer]">
                          <i className="fa fa-angle-down [text-rendering:auto]" />
                        </span>
                      </li>
                      <li id="menu-item-352">
                        <a href="/contato">Contato</a>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
              <div className="careerfy-btns-con align-middle">
                <div className="careerfy-right float-right">
                  <ul className="careerfy-user-section float-left">
                    <li className="jobsearch-usernotifics-menubtn">
                      <a>
                        <i className="fa fa-bell-o [text-rendering:auto]">
                          <span className="hderbell-notifics-count min-w-[15px] text-center">0</span>
                        </i>
                      </a>
                      <div className="jobsearch-hdernotifics-listitms text-left [transition:0.4s_ease-in-out]">
                        <div className="hdernotifics-title-con float-left"><span className="hder-notifics-title">Notificações</span><span className="hder-notifics-count float-right">0 novo</span></div>
                        <span className="hder-notifics-nofound float-left">Você não tem notificações.</span>
                      </div>
                    </li>
                    <li>
                      <a className="jobsearch-color">Registrar</a>
                    </li>
                    <li>
                      <a className="jobsearch-color jobsearch-open-signin-tab">Entrar</a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ImportedSectionProcessoQueAjudamA() {
  return (
    <section className="vc_section">
      <div className="vc_row wpb_row vc_custom_1737945546034 vc_row-has-fill">
        <div className={"\x63ontainer"}>
          <div className="row">
            <div className="wpb_column vc_column_container vc_col-sm-12">
              <div className="vc_column-inner vc_custom_1559373322169">
                <div className="wpb_wrapper">
                  <div className="careerfy-fancy-title-nine float-left text-center">
                    <small className="small-1406835373">01. <strong style={{ color: "rgb(48, 71, 165)" }}>Por que usar nossa plataforma?</strong></small>
                    <h2 style={{ color: "rgb(51, 51, 51)" }}>Processo que ajudam a valorizar o prestador!</h2>
                    <p style={{ color: "rgb(102, 102, 102)" }}>Use e ajude a divulgar a nossa plataforma em prol da valorização dos prestadores e não pelo menor preço.</p>
                  </div>
                  <div className="careerfy-services-nineview float-left">
                    <ul className="row" {...({ "\"": "" } as any)}>
                      <li className={"\x63ol-md-4 text-center"}>
                        <i className="careerfy-icon careerfy-pen" />
                        <h2>Nossos Valores</h2>
                        <p>Serviços de qualidade e pontuais para soluções sustentáveis por métodos automatizados e específicos</p>
                      </li>
                      <li className={"\x63ol-md-4 text-center"}>
                        <i className="careerfy-icon careerfy-target" />
                        <h2>Nossa Missão</h2>
                        <p>Fornecer serviços e facilidades para transformar nossa visão em realidade</p>
                      </li>
                      <li className={"\x63ol-md-4 text-center"}>
                        <i className="careerfy-icon careerfy-diamond" />
                        <h2>Nossa Visão</h2>
                        <p>Ser honesto e direto em tudo o que fazemos, ao mesmo tempo em que compreendemos e valorizamos as contribuições</p>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="vc_row wpb_row vc_custom_1737945533061 vc_row-has-fill">
        <div className={"\x63ontainer"}>
          <div className="row">
            <div className="wpb_animate_when_almost_visible zoomInUp wpb_column vc_column_container vc_col-sm-12 wpb_start_animation animated [@media(prefers-reduced-motion:reduce),(print)]:[transition-duration:1ms]!" style={{ transform: "scale3d(1, 1, 1) translate3d(0px, 0px, 0px)", opacity: "1" }}>
              <div className="vc_column-inner">
                <div className="wpb_wrapper">
                  <div className="careerfy-fancy-title-eleven float-left text-center">
                    <img decoding="async" src="/site-assets/bc1f98ba63502c82.png" />
                    <h2>Passos para ser encontrado</h2>
                    <span />
                  </div>
                  <div className="careerfy-services careerfy-services-style11">
                    <ul className="row">
                      <li className={"\x63ol-md-4 text-center"}>
                        <img decoding="async" src="/site-assets/cd00612a335b823e.png" alt="" />
                        <h2>
                          <a href="#">Crie uma conta!</a>
                        </h2>
                        <p />
                        <a className="careerfy-services-style11-btn" href="#"> Inscrever-se</a>
                      </li>
                      <li className={"\x63ol-md-4 text-center"}>
                        <img decoding="async" src="/site-assets/223dadea4f2e7272.png" alt="" />
                        <h2>
                          <a href="#">Faça seu perfil</a>
                        </h2>
                        <p />
                        <a className="careerfy-services-style11-btn" href="#"> Preencher</a>
                      </li>
                      <li className={"\x63ol-md-4 text-center"}>
                        <img decoding="async" src="/site-assets/65abac99fdecce85.png" alt="" />
                        <h2>
                          <a href="#">Capriche nos detalhes</a>
                        </h2>
                        <p />
                        <a className="careerfy-services-style11-btn" href="#"> Seja encontrado!</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ImportedFooterJob() {
  return (
    <footer className="careerfy-footer-one" data-wpr-lazyrender="1" id="careerfy-footer">
      <div className={"\x63ontainer"}>
        <div className="careerfy-footer-widget">
          <div className="row">
            <div className={"\x63ol-md-4"}>
              <aside className="widget" id="text-2">
                <div>
                  <p>
                    <img className={"alignnone \x73ize-medium wp-image-386"} decoding="async" src="/site-assets/3a944cf1d15ce4ae.webp" alt="" width="300" height="56" srcSet="/site-assets/3a944cf1d15ce4ae.webp 300w, /site-assets/99bf6851eea67efa.webp 324w" sizes="(max-width: 300px) 100vw, 300px" />
                  </p>
                </div>
              </aside>
            </div>
            <div className={"\x63ol-md-3"}>
              <aside className="widget widget_nav_menu" id="nav_menu-2">
                <div>
                  <ul className="menu" id="menu-for-candidates">
                    <li id="menu-item-291">
                      <a href="/painel-do-usuario">Painel do usuário</a>
                    </li>
                    <li id="menu-item-290">
                      <a href="/?page_id=175">CV Packages</a>
                    </li>
                    <li id="menu-item-288">
                      <a href="/?page_id=186">Candidate Listing</a>
                    </li>
                    <li id="menu-item-289">
                      <a href="/candidates-grid">Candidates Grid</a>
                    </li>
                    <li id="menu-item-287">
                      <a href="/?page_id=178">About us</a>
                    </li>
                    <li id="menu-item-292">
                      <a href="/contato">Contato</a>
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
            <div className={"\x63ol-md-3"}>
              <aside className="widget widget_nav_menu" id="nav_menu-3">
                <div>
                  <ul className="menu" id="menu-for-employer">
                    <li id="menu-item-286">
                      <a href="/publicar-nova-atividade">Publicar nova atividade</a>
                    </li>
                    <li id="menu-item-283">
                      <a href="/listagem-do-clientes">Listagem do clientes</a>
                    </li>
                    <li id="menu-item-284">
                      <a href="/?page_id=174">Employers Grid</a>
                    </li>
                    <li id="menu-item-285">
                      <a href="/job-packages">Job Packages</a>
                    </li>
                    <li id="menu-item-281">
                      <a href="/lista-de-atividades">Lista de atividades</a>
                    </li>
                    <li id="menu-item-282">
                      <a href="/jobs-style-grid">Jobs Style Grid</a>
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
            <div className={"\x63ol-md-2"}>
              <aside className="widget widget_nav_menu" id="nav_menu-4">
                <div className="footer-widget-title float-left">
                  <h2>job</h2>
                </div>
                <div>
                  <ul className="menu" id="menu-for-jobs">
                    <li id="menu-item-279">
                      <a href="/termos-e-condicoes">Termos e Condições</a>
                    </li>
                    <li id="menu-item-280">
                      <a href="/politica-de-privacidade" rel="privacy-policy">Política de Privacidade</a>
                    </li>
                    <li id="menu-item-295">
                      <a href="/job-packages">Job Packages</a>
                    </li>
                    <li id="menu-item-298">
                      <a href="/publicar-nova-atividade">Publicar nova atividade</a>
                    </li>
                    <li id="menu-item-296">
                      <a href="/lista-de-atividades">Lista de atividades</a>
                    </li>
                    <li id="menu-item-297">
                      <a href="/jobs-style-grid">Jobs Style Grid</a>
                    </li>
                    <li id="menu-item-293">
                      <a href="/listagem-do-clientes">Listagem do clientes</a>
                    </li>
                    <li id="menu-item-294">
                      <a href="/?page_id=174">Employers Grid</a>
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        </div>
        <div className="careerfy-copyright items-center [@media(max-width:767px)]:flex-wrap [@media(max-width:767px)]:text-center [@media(min-width:768px)_and_(max-width:990px)]:text-center">
          <p>Encontre um técnico | Preciso de um técnico © 2026, Todos os direitos reservados - por <a className="careerfy-color" href="#">Olhocix</a></p>
          <ul className="careerfy-social-network flex-wrap gap-[10px]">
            <li>
              <a className="fa fa-facebook-official justify-center min-w-[41px] text-center [text-rendering:auto]" href="#" target="_blank" />
            </li>
            <li>
              <a className="careerfy-icon careerfy-twitter justify-center min-w-[41px] text-center" href="#" target="_blank" />
            </li>
            <li>
              <a className="fa fa-google-plus justify-center min-w-[41px] text-center [text-rendering:auto]" href="#" target="_blank" />
            </li>
            <li>
              <a className="fa fa-linkedin justify-center min-w-[41px] text-center [text-rendering:auto]" href="#" target="_blank" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
