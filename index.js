import KcAdminClient from '@keycloak/keycloak-admin-client';

import config from './config.js';
import database from './database.js';

import express from 'express';
import bodyParser from 'body-parser';
import { gql } from 'graphql-request';
import Minio from 'minio';

const app = express();
const port = 3000;


const kcAdminClient = new KcAdminClient.default({
  baseUrl: config.keycloak.url,
  realmName: config.keycloak.realm,
});

const minioClient = new Minio.Client({
  endPoint: config.minio.url,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey
});


app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));


app.post("/ris/insert", async (req, res) => {
  const input = req.body.input;
  if (input.ris.allegati) {
    input.ris.allegati.data.map(allegato => {
      if (allegato.delete) {
        minioClient.removeObject('ris-' + input.ris.id, allegato.nome, function (err, etag) {
          if (err) console.log('Unable to remove object', err)
          console.log('Removed the object')
        });
      } else {
        var file = new Buffer.from(allegato.file.split(',')[1], 'base64');
        minioClient.putObject('ris-' + input.ris.id, 'allegati/' + allegato.nome, file, {
          'Content-Type': allegato.tipo,
        }, function (err, objInfo) {
          if (err) return console.log(err) // err should be null
          console.log("Success", objInfo)
        })
      }
    })
    delete input.ris.allegati;
  }

  const mutation = gql`
  mutation UpdateRis(
    $ris: [ris_insert_input!] = {}
    $on_conflict: ris_on_conflict = { constraint: ris_pkey }
  ) {
    insert_ris(objects: $ris, on_conflict: $on_conflict) {
      returning {
        id
      }
    }
  }
`;
  let response = await database.queryFetch(mutation, {
    ris: input.ris,
    on_conflict: input.on_conflict
  });
  res.send({
    ris_id: response.insert_ris.returning[0].id,
  });
});


app.post("/unita/operativa/aggiungi", async (req, res) => {
  try {
    var data = req.body.event.data;
    await kcAdminClient.auth({
      clientSecret: config.keycloak.secret,
      grantType: 'client_credentials',
      clientId: 'admin-cli'
    });
    await kcAdminClient.groups.setOrCreateChild(
      { id: 'a83c0c98-2015-481e-b230-faf856cb04a1' },
      {
        name: data.new.id,
        attributes: {
          nome: [data.new.nome]
        }
      },
    );
    res.send("OK");
  } catch (e) {
    console.log(e);
    res.send(e);
  }
});

app.post("/unita/operativa/cancella", async (req, res) => {
  try {
    var data = req.body.event.data;
    await kcAdminClient.auth({
      clientSecret: config.keycloak.secret,
      grantType: 'client_credentials',
      clientId: 'admin-cli'
    });
    const groups = await kcAdminClient.groups.findOne({
      id: 'a83c0c98-2015-481e-b230-faf856cb04a1'
    });
    const groupId = groups.subGroups.filter(group => group.name == String(data.old.id))[0].id
    await kcAdminClient.groups.del({
      id: groupId
    });
    res.send("OK");
  } catch (e) {
    console.log(e);
    res.send(e);
  }
});



app.post("/ris/protocolla", async (req, res) => {
  const data = req.body.event.data;
  if (data.old.stato != data.new.stato && data.new.stato == 'PROTOCOLLATO') {

    const query = gql
      `query Ris($where: ris_bool_exp = {}) {
        ris(where: $where) {
          id
          unita_operativa {
            id
            nome
          }
          agenti_accertatori {
            id
            username
            agente
          }
          infortunati {
            cognome
            conducente {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
            }
            cura_da_parte
            danni_lamentati
            id
            informazioni {
              id
              informazione {
                id
                nome
              }
            }
            nascita_citta_altro
            nascita_citta {
              citta
              id
              codice
              provincia
              p_abbreviazione
              regione
            }
            nascita_data
            nome
            telefono
            ospedale_altro
            ospedale_diagnosi
            ospedale_prognosi
            ospedale_referto
            ospedale_referto_rilasciato_da
            ospedale_ricoverato
            pedone {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
            }
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_indirizzo
            rifiuta_cure_immediate
            scheda_118
            sesso {
              id
              nome
            }
            titolo {
              id
              nome
            }
            trasportato {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
            }
            trasportato_ambulanza {
              id
              nome
            }
            trasportato_richiesta
            trasportato_targa_auto
            veicolo {
              id
              marca
              modello
              targa
            }
          }
          municipalita {
            id
            nome
          }
          quartiere {
            id
            nome
            municipalita {
              municipalita_id
            }
          }
          toponimo {
            id
            nome
            dug {
              id
              nome
            }
            codice
            assegnazioni {
              quartiere_id
            }
          }
          municipalita_storica
          quartiere_storico
          toponimo_storico
          accertamenti {
            centro_abitato
            condizioni_meteo_illuminazione
            condizioni_meteo_tempo
            condizioni_meteo_visibilita_limitata
            condizioni_meteo_visibilita_limitata_tipologia {
              id
              condizioni_meteo_visibilita_limitata_tipologia {
                id
                nome
              }
            }
            condizioni_meteo_visibilita_limitata_tipologia_metri
            data
            descrizione_piano_note
            descrizione_piano_pavimentazione
            descrizione_piano_stato_fondo
            direzione_a
            direzione_da
            id
            segnaletica
            tipologia_strada_carreggiate
            tipologia_strada_carreggiate_n
            tipologia_strada_conformazione
            traffico
          }
          altri {
            id
            note
          }
          altro
          conducenti {
            cap_numero
            cap_rilasciata_da_ddt
            cap_rilasciata_da_ddt_data
            cap_tipo
            cognome
            id
            nascita_citta {
              citta
              codice
              p_abbreviazione
              id
              provincia
              regione
            }
            nascita_citta_altro
            nascita_data
            nome
            osservazioni_note
            patente_altro_note
            patente_categoria_altro
            patente_numero
            patente_prescrizioni
            patente_rilasciata_da
            patente_rilasciata_da_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            patente_rilasciata_data
            patente_rilasciata_valida_data
            patente_sinoaltro {
              id
              nome
            }
            professione
            prova_etilometro
            prova_etilometro_esito
            prova_narcotest
            prova_narcotest_esito
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_indirizzo
            richiesta_esami
            richiesta_esami_effettuati_presso
            sesso {
              id
              nome
            }
            telefono
            titolo {
              id
              nome
            }
            patente {
              id
              patente_categoria {
                id
                nome
              }
            }
          }
          conseguenza_veicolo_note
          conseguenze_veicolo {
            id
            conseguenza_veicolo {
              nome
              id
            }
          }
          data
          data_intervento
          data_presunta
          data_segnalazione
          decessi_certificato
          decessi_certificato_redattore
          decessi_certificato_redattore_in_servizio
          decessi_certificato_redattore_recapito
          decessi_intervento_polizia_mortuaria
          decessi_note
          decessi_notiziato_pm
          decessi_numero
          decessi_oggetti_rinvenuti
          decessi_successivo_data
          decessi_tipologie {
            id
            decessi_tipologia {
              id
              nome
            }
          }
          decessi_trasporto_salme_data
          decessi_trasporto_salme_presso
          decessi_verbale_riconoscimento_salma
          dinamica
          ente_primo_intervento_note
          ente_secondario_intervenuti_altro
          ente_secondario_intervenuti_motivazione
          ente_secondario_intervenuti_vvff_capo_pattuglia
          ente_secondario_intervenuti_vvff_comando
          ente_secondario_intervenuti_vvff_gia_intervenuti
          ente_segnalatore_note
          enti_primo_intervento {
            id
            targa_auto
            tipo
            ente {
              label_tipo
              nome
              id
            }
          }
          enti_secondario_intervenuti {
            id
            ente_secondario {
              id
              nome
            }
          }
          enti_segnalatori {
            id
            ente {
              id
              label_tipo
              nome
              abbreviazione
            }
          }
          eventi {
            stato
            note
            motivazione_cancellazione
            protocollo {
              numero
              data
              note
            }
            created_at
            cancellatore
          }
          impianti_semaforici {
            id
            impianto_semaforico {
              id
              nome
            }
          }
          impianto_semaforico_note
          infrazioni {
            verbale_n
            verbale_data
            art_80_data
            art_80_dtt
            articolo
            conducente {
              cognome
              id
              nascita_citta {
                citta
                codice
                p_abbreviazione
                id
                provincia
                regione
              }
              nascita_citta_altro
              nascita_data
              nome
              patente_altro_note
              patente_categoria_altro
              patente_numero
              patente_prescrizioni
              patente_rilasciata_da
              patente_rilasciata_da_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              patente_rilasciata_data
              patente_rilasciata_valida_data
              patente_sinoaltro {
                id
                nome
              }
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              sesso {
                id
                nome
              }
              telefono
              titolo {
                id
                nome
              }
              patente {
                id
                patente_categoria {
                  id
                  nome
                }
              }
            }
            data_trasmissione_rapporto
            id
            note
            pedone {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              sesso {
                id
                nome
              }
              telefono
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              documento_numero
              documento_rilasciato_da
              documento_rilasciato_da_citta {
                id
                citta
                codice
                p_abbreviazione
                provincia
                regione
              }
              documento_rilasciato_data
              documento_tipo
            }
            uffici_provinciale
            utg_prefettura
            veicolo {
              id
              colore_carrozzeria
              marca
              modello
              nazione {
                nome
              }
              targa
              telaio
            }
          }
          localizzazione_altro_note
          localizzazione_condizioni_atmosferiche_note
          localizzazione_condizioni_traffico_note
          localizzazione_extra_abitato_note
          localizzazione_fondo_stradale_note
          localizzazione_illuminazione_note
          localizzazione_note
          localizzazione_particolarita_strada_note
          localizzazione_pavimentazione_note
          localizzazione_tipo_strada_note
          localizzazione_visibilita_note
          localizzazioni_altro {
            id
            localizzazione_altro {
              id
              nome
            }
          }
          localizzazioni_condizioni_atmosferiche {
            id
            localizzazione_condizioni_atmosferiche {
              id
              nome
            }
          }
          localizzazioni_condizioni_traffico {
            id
            localizzazione_condizioni_traffico {
              id
              nome
            }
          }
          localizzazioni_extra_abitato {
            id
            localizzazione_extra_abitato {
              id
              nome
            }
          }
          localizzazioni_fondo_stradale {
            id
            localizzazione_fondo_stradale {
              id
              nome
            }
          }
          localizzazioni_illuminazione {
            id
            localizzazione_illuminazione {
              id
              nome
            }
          }
          localizzazioni_particolarita_strada {
            id
            localizzazione_particolarita_strada {
              id
              nome
            }
          }
          localizzazioni_pavimentazione {
            id
            localizzazione_pavimentazione {
              id
              nome
            }
          }
          localizzazioni_tipo_strade {
            id
            localizzazione_tipo_strada {
              id
              nome
            }
          }
          localizzazioni_visibilita {
            id
            localizzazione_visibilitum {
              nome
              id
            }
          }
          locatari {
            id
            nome
            cognome
            titolo {
              id
              nome
            }
            sesso {
              id
              nome
            }
            telefono
            residente_indirizzo
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            nascita_data
            nascita_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            nascita_citta_altro
          }
          natura_incidente_note
          nature_incidente {
            id
            natura_incidente {
              id
              nome
            }
          }
          note_intervento
          operazione_terminate_data
          pedoni {
            id
            nome
            cognome
            titolo {
              nome
              id
            }
            nascita_data
            nascita_citta {
              citta
              p_abbreviazione
              codice
              provincia
              regione
              id
            }
            nascita_citta_altro
            documento_numero
            documento_rilasciato_da
            documento_rilasciato_da_citta {
              id
              citta
              codice
              p_abbreviazione
              provincia
              regione
            }
            documento_rilasciato_data
            documento_tipo
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_indirizzo
            sesso {
              id
              nome
            }
            telefono
          }
          posizionamento_toponimo {
            civico
            connessione
            geoloc
            id
            ipi
            km
            note
            specifica {
              id
              nome
            }
            tipologia {
              id
              nome
            }
          }
          posizione_finale_veicolo_carreggiata_note
          posizione_finale_veicolo_fuori_sede_note
          posizione_finale_veicolo_margini_note
          posizione_statica_descrizione_analitica
          posizione_statica_rilievi
          posizione_statica_rilievi_no_tipologia {
            id
            nome
          }
          posizione_statica_rilievi_veicoli_rimossi
          posizioni_finali_veicolo_carreggiata {
            id
            posizione_finale_veicolo_carreggiata {
              id
              nome
            }
          }
          posizioni_finali_veicolo_fuori_sede {
            id
            posizione_finale_veicolo_fuori_sede {
              id
              nome
            }
          }
          posizioni_finali_veicolo_margini {
            id
            posizione_finale_veicolo_margini {
              id
              nome
            }
          }
          proprietari {
            cognome
            id
            nascita_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            nascita_citta_altro
            nascita_data
            nome
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_indirizzo
            sesso {
              id
              nome
            }
            telefono
            titolo {
              id
              nome
            }
          }
          proprietari_giuridico {
            citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            citta_altro
            codice_fiscale
            id
            indirizzo
            partita_iva
            ragione_sociale
            telefono
          }
          protocollo {
            note
            numero
            mittente {
              id
              nome
              sigla
              codice
            }
            id
            destinatari {
              id
              e_esterno
              destinatario_interno {
                id
                nome
                codice
                sigla
              }
              destinatario_esterno {
                id
                cognome
                email
                codice_fiscale
                nome
              }
            }
            data
          }
          punti_descrizione_analitica
          punti_investimento
          punti_investimento_multiplo
          punti_rilievi
          punti_rilievi_no_tipologia {
            id
            nome
          }
          punti_urto
          punti_urto_accorda
          punti_urto_multiplo
          punti_urto_note
          ris_consegnato_a {
            id
            nome
          }
          ris_consegnato_a_altro
          ris_consegnato_data
          stato
          testimoni {
            cognome
            documento_numero
            documento_rilasciato_da
            documento_rilasciato_da_citta {
              citta
              codice
              id
              p_abbreviazione
              regione
              provincia
            }
            documento_rilasciato_data
            documento_tipo
            id
            nascita_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            nascita_citta_altro
            nascita_data
            nome
            residente_citta {
              citta
              codice
              ordine
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_indirizzo
            sesso {
              id
              nome
            }
            telefono
            titolo {
              id
              nome
            }
          }
          tipologie_ris {
            id
            tipologia {
              id
              nome
            }
          }
          trasportati {
            accertamento_attivazione_airbag
            accertamento_uso_casco
            accertamento_uso_cintura
            accertamento_uso_sistema_bambini
            cognome
            documento_numero
            documento_rilasciato_da
            documento_rilasciato_da_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            documento_rilasciato_data
            documento_tipo
            id
            nascita_citta {
              codice
              citta
              id
              p_abbreviazione
              provincia
              regione
            }
            nascita_citta_altro
            nascita_data
            nome
            posizione {
              id
              nome
            }
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_citta_id
            residente_indirizzo
            sesso {
              id
              nome
            }
            stato {
              id
              nome
            }
            telefono
            titolo {
              id
              nome
            }
          }
          veicoli {
            accertamenti_abs
            accertamenti_attivazione
            accertamenti_uso_casco_altro_note
            accertamenti_uso_casco_sinoaltro {
              id
              nome
            }
            accertamenti_uso_cintura_altro_note
            accertamenti_uso_cintura_sinoaltro {
              id
              nome
            }
            accertamento_uso_antiabbandono_sinoaltro {
              id
              nome
            }
            accertamento_uso_antiabbandono_altro_note
            accertamento_uso_sistema_bambini_altro_note
            accertamento_uso_sistema_bambini_sinoaltro {
              id
              nome
            }
            alimentazione {
              id
              nome
            }
            alimentazione_note
            anno_prima_immatricolazione
            assicurazione_agenzia
            assicurazione_altro_note
            assicurazione_data_fine
            assicurazione_data_inizio
            assicurazione_polizza
            assicurazione_sinoaltro {
              id
              nome
            }
            assicurazione_societa
            carta_circolazione
            carta_circolazione_altro_note
            carta_circolazione_data
            carta_circolazione_ddt
            carta_circolazione_ril
            carta_circolazione_sinoaltro {
              id
              nome
            }
            cilindrata
            codice_merce_pericolasa
            codice_pericolo
            colore_carrozzeria
            conducente {
              cap_numero
              cap_rilasciata_da_ddt
              cap_rilasciata_da_ddt_data
              cap_tipo
              cognome
              id
              nascita_citta {
                citta
                codice
                p_abbreviazione
                id
                provincia
                regione
              }
              nascita_citta_altro
              nascita_data
              nome
              osservazioni_note
              patente_altro_note
              patente_categoria_altro
              patente_numero
              patente_prescrizioni
              patente_rilasciata_da
              patente_rilasciata_da_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              patente_rilasciata_data
              patente_rilasciata_valida_data
              patente_sinoaltro {
                id
                nome
              }
              professione
              prova_etilometro
              prova_etilometro_esito
              prova_narcotest
              prova_narcotest_esito
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              richiesta_esami
              richiesta_esami_effettuati_presso
              sesso {
                id
                nome
              }
              telefono
              titolo {
                id
                nome
              }
              patente {
                id
                patente_categoria {
                  id
                  nome
                }
              }
            }
            danni_del_veicolo_a_cose
            danni_del_veicolo_a_cose_rilievo
            danni_del_veicolo_a_cose_rilievo_data_fine
            danni_del_veicolo_a_cose_rilievo_data_inizio
            danni_del_veicolo_a_cose_rilievo_difensore
            danni_del_veicolo_a_cose_rilievo_presente
            danni_su_veicolo_constatati
            data_ultima_revisione
            destinazione_data
            destinazione_decisione {
              id
              nome
            }
            destinazione_decisione_altro
            destinazione_decisione_id
            destinazione_persona_affidataria
            destinazione_ritirato
            destinazione_sequestrato
            destinazione_trasportato_presso
            dispositivi_acustici
            dotazione_airbag
            dotazione_cinture
            generale
            id
            impianto_illuminazione
            indicatori_direzione
            km_percorsi
            locatario {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
            }
            luci_arresto
            marca
            marcia_inserita
            modello
            nazione {
              id
              nome
            }
            p_c
            p_u
            peso
            posti
            proprietario {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
            }
            proprietario_giuridico {
              id
              ragione_sociale
              partita_iva
              codice_fiscale
              citta {
                citta
                p_abbreviazione
              }
              citta_altro
            }
            retrovisore_esterno {
              id
              nome
            }
            stato {
              id
              nome
            }
            stato_pneumatici
            tara
            targa
            telaio
            tipologia_veicolo {
              id
              nome
            }
            tipologia_veicolo_note
            traccia_suolo
            traccia_suolo_abs
            traccia_suolo_frenata_tipologium {
              nome
              id
            }
            traccia_suolo_metri
            traccia_suolo_terminazione {
              id
              nome
            }
            traccia_suolo_terminazione_andamento {
              id
              nome
            }
            traccia_suolo_terminazione_forma {
              id
              nome
            }
            traccia_suolo_terminazione_intensitum {
              id
              nome
            }
            traccia_suolo_terminazione_metri
            traccia_suolo_terminazione_tipologium {
              id
              nome
            }
            traccia_suolo_tipologium {
              id
              nome
            }
            trasportati {
              id
              trasportato {
                id
                nome
                cognome
                titolo {
                  nome
                }
                nascita_data
                nascita_citta {
                  citta
                  p_abbreviazione
                }
                nascita_citta_altro
                residente_citta {
                  citta
                  codice
                  id
                  p_abbreviazione
                  provincia
                  regione
                }
                residente_citta_altro
                residente_indirizzo
                documento_numero
                documento_rilasciato_da
                documento_rilasciato_da_citta {
                  id
                  citta
                  codice
                  p_abbreviazione
                  provincia
                  regione
                }
                documento_rilasciato_data
                documento_tipo
                posizione {
                  id
                  nome
                }
                stato {
                  id
                  nome
                }
                accertamento_uso_cintura
                accertamento_uso_casco
                accertamento_attivazione_airbag
                accertamento_uso_sistema_bambini
              }
            }
            uso_veicolo {
              id
              nome
            }
            velocita_presunta
          }
          verbali {
            cellulare
            cognome
            veicolo {
              id
              marca
              modello
              targa
            }
            conducente {
              cognome
              id
              nascita_citta {
                citta
                codice
                p_abbreviazione
                id
                provincia
                regione
              }
              nascita_citta_altro
              nascita_data
              nome
              patente_altro_note
              patente_categoria_altro
              patente_numero
              patente_prescrizioni
              patente_rilasciata_da
              patente_rilasciata_da_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              patente_rilasciata_data
              patente_rilasciata_valida_data
              patente_sinoaltro {
                id
                nome
              }
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              sesso {
                id
                nome
              }
              telefono
              titolo {
                id
                nome
              }
              patente {
                id
                patente_categoria {
                  id
                  nome
                }
              }
            }
            coniugato
            data
            dichiarazione
            documento_numero
            documento_rilasciato_da
            documento_rilasciato_da_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            documento_rilasciato_data
            documento_tipo
            id
            locatario {
              id
              nome
              cognome
              titolo {
                nome
              }
              sesso {
                id
                nome
              }
              telefono
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
            }
            motivazione_no_sottoscrizione
            nascita_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            nascita_citta_altro
            nascita_data
            nome
            pedone {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              sesso {
                id
                nome
              }
              telefono
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              documento_numero
              documento_rilasciato_da
              documento_rilasciato_da_citta {
                id
                citta
                codice
                p_abbreviazione
                provincia
                regione
              }
              documento_rilasciato_data
              documento_tipo
            }
            professione
            proprietario {
              id
              nome
              cognome
              titolo {
                nome
              }
              sesso {
                id
                nome
              }
              telefono
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
            }
            residente_citta {
              citta
              codice
              id
              p_abbreviazione
              provincia
              regione
            }
            residente_citta_altro
            residente_indirizzo
            sesso {
              id
              nome
            }
            telefono
            trasportato {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              sesso {
                id
                nome
              }
              telefono
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              documento_numero
              documento_rilasciato_da
              documento_rilasciato_da_citta {
                id
                citta
                codice
                p_abbreviazione
                provincia
                regione
              }
              documento_rilasciato_data
              documento_tipo
            }
            testimone {
              id
              nome
              cognome
              titolo {
                nome
              }
              nascita_data
              nascita_citta {
                citta
                p_abbreviazione
              }
              sesso {
                id
                nome
              }
              telefono
              nascita_citta_altro
              residente_citta {
                citta
                codice
                id
                p_abbreviazione
                provincia
                regione
              }
              residente_citta_altro
              residente_indirizzo
              documento_numero
              documento_rilasciato_da
              documento_rilasciato_da_citta {
                id
                citta
                codice
                p_abbreviazione
                provincia
                regione
              }
              documento_rilasciato_data
              documento_tipo
            }
            tipologia_verbale {
              id
              nome
            }
            titolo {
              id
              nome
            }
          }
        }
      }`;
    let response = await database.queryFetch(query, {
      where: { id: { _eq: data.new.id } },
    });
    const template = await fetch(
      config.template.url + '/ris.docx'
    ).then((v) => v.arrayBuffer());
    const ris = response.ris[0];
    const report = await createReport.default({
      template: template,
      data: ris,
      noSandbox: true,
    });
    var pdfBuffer = await toPdf(report)
    var file = new Buffer.from(pdfBuffer);
    var filename = ris.protocollo.numero + ".pdf";
    minioClient.putObject('ris-' + data.new.id, filename, file, {
      'Content-Type': 'application/pdf',
    }, function (err, objInfo) {
      if (err) return console.log(err) // err should be null
      console.log("Success", objInfo)

      superagent.post(config.protocollo.url + '/aggiungi_allegato').field('protocollo', filename).attach('file', file, { filename: filename }).end(function (error, response) {
        if (error) return console.log(error) // err should be null
        console.log(response);
      })


    });
  }
});

app.get('/_health', (req, res) => {
  res.send({'status': 'ok'}); // Simple health endpoint so kubernetes/other know that service is up and running
});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
