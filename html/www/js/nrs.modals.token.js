/******************************************************************************
 * Copyright © 2013-2016 The Nxt Core Developers.                             *
 * Copyright © 2016-2023 Jelurida IP B.V.                                     *
 * Copyright © 2023-2025 Jelurida Swiss SA                                    *
 *                                                                            *
 * See the LICENSE.txt file at the top-level directory of this distribution   *
 * for licensing information.                                                 *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida      *
 * Swiss SA, no part of this software, including this file, may be copied     *
 * modified, propagated, or distributed except according to the terms         *
 * contained in the LICENSE.txt file.                                         *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

/**
 * @depends {nrs.js}
 * @depends {nrs.modals.js}
 */
var NRS = (function(NRS, $) {
    var _password = null;
    var tokenModal = $("#token_modal");
    var hubzamSigner = {
        active: false,
        requestId: null,
        returnOrigin: null,
        publicKey: null,
        challenge: null,
        secretPhrase: null
    };

    function isCanonicalPublicKey(value) {
        return /^[0-9a-f]{64}$/i.test(String(value || ""));
    }

    function isCanonicalSignature(value) {
        return /^[0-9a-f]{128}$/i.test(String(value || ""));
    }

    function getQueryParam(name) {
        var match = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search || "");
        return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
    }

    function normalizeOrigin(value) {
        try {
            var parser = document.createElement("a");
            parser.href = value;
            if (!parser.protocol || !parser.host) {
                return "";
            }
            return parser.protocol + "//" + parser.host;
        } catch (e) {
            return "";
        }
    }

    function isAllowedHubzamOrigin(origin) {
        var normalized = normalizeOrigin(origin);
        if (!normalized || normalized !== String(origin || "").replace(/\/$/, "")) {
            return false;
        }
        var parser = document.createElement("a");
        parser.href = normalized;
        var host = String(parser.hostname || "").toLowerCase();
        var protocol = String(parser.protocol || "").toLowerCase();

        if (protocol === "https:" && (
            host === "hubzamworks.162-35-102-161.sslip.io" ||
            host === "hubzamworks.com" ||
            host === "www.hubzamworks.com" ||
            /\.hubzamworks\.com$/.test(host)
        )) {
            return true;
        }

        return protocol === "http:" && (host === "localhost" || host === "127.0.0.1");
    }

    function signerError(message) {
        $("#sign_message_error").text(message || "Could not sign this message.").show();
    }

    function clearSignerError() {
        $("#sign_message_error").hide().text("");
    }

    function setHubzamStatus(message) {
        $("#hubzam_signer_status").text(message || "");
    }

    function setSignButtonState(label, disabled) {
        $("#sign_message_button").text(label).prop("disabled", !!disabled).show();
    }

    function activateTokenTab(tab) {
        tokenModal.find("ul.nav li").removeClass("active");
        tokenModal.find("ul.nav li[data-tab='" + tab + "']").addClass("active");
        $(".token_modal_content").hide();
        $("#token_modal_" + tab).show();

        $("#generate_token_button, #validate_token_button, #sign_message_button").hide();
        if (tab === "generate_token") {
            $("#generate_token_button").show();
        } else if (tab === "validate_token") {
            $("#validate_token_button").show();
        } else if (tab === "sign_message") {
            $("#sign_message_button").show();
        }
    }

    function postHubzamMessage(type, payload) {
        if (!hubzamSigner.active || !window.opener || window.opener.closed) {
            return false;
        }
        var message = $.extend({
            type: type,
            request_id: hubzamSigner.requestId
        }, payload || {});
        window.opener.postMessage(message, hubzamSigner.returnOrigin);
        return true;
    }

    function derivePublicKey(secretPhrase) {
        return NRS.getPublicKey(converters.stringToHexString(secretPhrase));
    }

    function currentSigningSecret() {
        if (hubzamSigner.secretPhrase) {
            return hubzamSigner.secretPhrase;
        }
        if (NRS.rememberPassword && _password) {
            return _password;
        }
        return String(NRS.getFormData($("#sign_message_form")).secretPhrase || "");
    }

    function validateSecretForWallet(secretPhrase, expectedPublicKey) {
        if (!secretPhrase) {
            throw new Error("Enter your Arkovia passphrase in the wallet to continue.");
        }
        var publicKey = derivePublicKey(secretPhrase);
        if (!isCanonicalPublicKey(publicKey)) {
            throw new Error("Could not derive a valid Arkovia public key.");
        }
        if (expectedPublicKey && publicKey.toLowerCase() !== expectedPublicKey.toLowerCase()) {
            throw new Error("That passphrase belongs to a different Arkovia wallet.");
        }
        if (hubzamSigner.active && NRS.account) {
            var accountId = NRS.getAccountId(secretPhrase);
            if (String(accountId) !== String(NRS.account)) {
                throw new Error("That passphrase does not match the Arkovia account open in this wallet.");
            }
        }
        return publicKey.toLowerCase();
    }

    function sendHubzamIdentity(publicKey) {
        hubzamSigner.publicKey = String(publicKey || "").toLowerCase();
        if (!isCanonicalPublicKey(hubzamSigner.publicKey)) {
            signerError("Arkovia could not determine a valid public key for this wallet.");
            return;
        }
        postHubzamMessage("ARKOVIA_HUBZAM_IDENTITY", {
            public_key_hex: hubzamSigner.publicKey
        });
        setHubzamStatus("Wallet connected. Waiting for Hubzam to create the one-time login challenge…");
        setSignButtonState("Waiting for Hubzam…", true);
    }

    function validateHubzamChallenge(challenge) {
        if (!hubzamSigner.publicKey || typeof challenge !== "string" || challenge.length > 4096) {
            return false;
        }
        var lines = challenge.split("\n");
        if (lines[0] !== "HUBZAM_ARKOVIA_LOGIN_V1" || lines[1] !== "purpose=login") {
            return false;
        }
        if (lines.indexOf("public_key_hex=" + hubzamSigner.publicKey) === -1) {
            return false;
        }
        var expiresLine = null;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf("expires_at=") === 0) {
                expiresLine = lines[i].substring("expires_at=".length);
                break;
            }
        }
        if (!expiresLine || isNaN(Date.parse(expiresLine)) || Date.parse(expiresLine) <= Date.now()) {
            return false;
        }
        return true;
    }

    function initializeHubzamSigner() {
        if (getQueryParam("arkovia_signer") !== "hubzam") {
            return;
        }

        var requestId = getQueryParam("request_id");
        var returnOrigin = normalizeOrigin(getQueryParam("return_origin"));
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(requestId) || !isAllowedHubzamOrigin(returnOrigin)) {
            return;
        }
        if (!window.opener || window.opener.closed) {
            return;
        }

        hubzamSigner.active = true;
        hubzamSigner.requestId = requestId;
        hubzamSigner.returnOrigin = returnOrigin;

        $("#hubzam_signer_context").show();
        $("#hubzam_signer_origin").text("Requesting app: " + returnOrigin);
        $("#sign_message_data").prop("readonly", true).val("");
        setHubzamStatus("Secure connection established. Preparing your wallet…");
        activateTokenTab("sign_message");
        tokenModal.find("ul.nav li").hide();
        $("#sign_message_nav").show();
        tokenModal.modal("show");

        postHubzamMessage("ARKOVIA_HUBZAM_READY", {
            signer_version: 1
        });

        if (isCanonicalPublicKey(NRS.publicKey)) {
            sendHubzamIdentity(String(NRS.publicKey).toLowerCase());
        } else if (NRS.rememberPassword && _password) {
            try {
                sendHubzamIdentity(validateSecretForWallet(_password, null));
            } catch (e) {
                signerError(e.message);
                setSignButtonState("Connect Wallet", false);
            }
        } else {
            setHubzamStatus("Unlock your Arkovia wallet below. Your passphrase stays inside this local wallet.");
            setSignButtonState("Connect Wallet", false);
        }
    }

    tokenModal.on("show.bs.modal", function(e) {
        $("#generate_token_output, #decode_token_output, #generate_token_output_qr_code").html("").hide();
        $("#sign_message_output").val("");
        $("#sign_message_output_group").hide();
        clearSignerError();

        var $invoker = $(e.relatedTarget);
        var openSignMessage = hubzamSigner.active || !!$invoker.data("sign-message");
        var isOffline = !!$invoker.data("offline");

        if (openSignMessage) {
            activateTokenTab("sign_message");
        } else {
            activateTokenTab("generate_token");
        }

        if (isOffline) {
            $(this).find("ul.nav li").hide();
            $(this).find("ul.nav li:first").show();
            $(this).find(".mobile-offline").val("true");
        } else if (!hubzamSigner.active) {
            $(this).find("ul.nav li").show();
        }

        if (!hubzamSigner.active) {
            $("#hubzam_signer_context").hide();
            $("#sign_message_data").prop("readonly", false);
            setSignButtonState("Sign Message", false);
        }
    });

    NRS.forms.decodeToken = function() {
        return {
            data: {
                "website": $("#decode_token_data").val(),
                "token": $("#decode_token_token").val()
            }
        };
    };

    NRS.forms.decodeTokenComplete = function(response) {
        $("#token_modal").find(".error_message").hide();

        if (response.valid) {
            $("#decode_token_output").html($.t("success_valid_token", {
                "account_link": NRS.getAccountLink(response, "account"),
                "timestamp": NRS.formatTimestamp(response.timestamp)
            })).addClass("callout-info").removeClass("callout-danger").show();
        } else {
            $("#decode_token_output").html($.t("error_invalid_token", {
                "account_link": NRS.getAccountLink(response, "account"),
                "timestamp": NRS.formatTimestamp(response.timestamp)
            })).addClass("callout-danger").removeClass("callout-info").show();
        }
    };

    NRS.forms.decodeTokenError = function() {
        $("#decode_token_output").hide();
    };

    tokenModal.find("ul.nav li").click(function(e) {
        e.preventDefault();
        if (hubzamSigner.active) {
            return;
        }
        activateTokenTab($(this).data("tab"));
        $("#token_modal").find(".error_message, #sign_message_error").hide();
    });

    tokenModal.on("hidden.bs.modal", function() {
        if (hubzamSigner.active) {
            return;
        }
        $(this).find(".token_modal_content").hide();
        $(this).find("ul.nav li.active").removeClass("active");
        $("#generate_token_nav").addClass("active");
        $("#sign_message_output").val("");
        $("#sign_message_output_group").hide();
    });

    $("#generate_token_button").click(function (e) {
        var data = NRS.getFormData($("#generate_token_form"));
        var website = data.website;
        var tokenOutput = $("#generate_token_output");
        var outputQrCodeContainer = $("#generate_token_output_qr_code");
        if (!website || website == "") {
            tokenOutput.html($.t("data_required_field"));
            tokenOutput.addClass("callout-danger").removeClass("callout-info").show();
            outputQrCodeContainer.hide();
            return;
        }
        var isOffline = !!$(this).find(".mobile-offline").val();
        var secretPhrase;
        if (!NRS.rememberPassword) {
            secretPhrase = data.secretPhrase;
            var accountId = NRS.getAccountId(secretPhrase);
            if (accountId != NRS.account && !isOffline) {
                tokenOutput.html($.t("error_incorrect_passphrase"));
                tokenOutput.addClass("callout-danger").removeClass("callout-info").show();
                outputQrCodeContainer.hide();
                return;
            }
        } else {
            secretPhrase = _password;
        }
        var token = NRS.generateToken(website, secretPhrase);
        tokenOutput.html($.t("generated_token_is") + "<br/><br/><textarea readonly style='width:100%' rows='3'>" + token + "</textarea>");
        tokenOutput.addClass("callout-info").removeClass("callout-danger").show();
        NRS.generateQRCode("#generate_token_output_qr_code", token, 14);
        outputQrCodeContainer.show();
        e.preventDefault();
    });

    $("#sign_message_button").click(function(e) {
        e.preventDefault();
        clearSignerError();

        try {
            if (hubzamSigner.active && !hubzamSigner.publicKey) {
                var connectSecret = currentSigningSecret();
                var connectPublicKey = validateSecretForWallet(connectSecret, null);
                hubzamSigner.secretPhrase = connectSecret;
                $("#sign_message_form input[name='secretPhrase']").val("");
                sendHubzamIdentity(connectPublicKey);
                return;
            }

            var message = String($("#sign_message_data").val() || "");
            if (!message) {
                throw new Error("Enter the exact message you want to sign.");
            }

            if (hubzamSigner.active && !hubzamSigner.challenge) {
                throw new Error("Hubzam has not supplied a valid login challenge yet.");
            }

            var secretPhrase = currentSigningSecret();
            var expectedPublicKey = hubzamSigner.active ? hubzamSigner.publicKey : null;
            var publicKey = validateSecretForWallet(secretPhrase, expectedPublicKey);

            if (hubzamSigner.active && !validateHubzamChallenge(message)) {
                throw new Error("This is not a valid, current Hubzam login challenge for this wallet.");
            }

            var signature = NRS.signBytes(
                converters.stringToHexString(message),
                converters.stringToHexString(secretPhrase)
            );
            if (!isCanonicalSignature(signature)) {
                throw new Error("Arkovia produced an invalid signature.");
            }

            $("#sign_message_output").val(signature);
            $("#sign_message_output_group").show();
            $("#sign_message_form input[name='secretPhrase']").val("");

            if (hubzamSigner.active) {
                hubzamSigner.secretPhrase = null;
                postHubzamMessage("ARKOVIA_HUBZAM_SIGNATURE", {
                    public_key_hex: publicKey,
                    signature_hex: signature
                });
                setHubzamStatus("Signed securely. Returning the signature to Hubzam for verification…");
                setSignButtonState("Signature Sent", true);
            }
        } catch (err) {
            signerError(err && err.message ? err.message : String(err));
            if (hubzamSigner.active && hubzamSigner.challenge) {
                setSignButtonState("Approve & Sign", false);
            } else if (hubzamSigner.active) {
                setSignButtonState("Connect Wallet", false);
            }
        }
    });

    window.addEventListener("message", function(event) {
        if (!hubzamSigner.active || event.origin !== hubzamSigner.returnOrigin || event.source !== window.opener) {
            return;
        }
        var data = event.data || {};
        if (data.request_id !== hubzamSigner.requestId || data.type !== "ARKOVIA_HUBZAM_SIGN_REQUEST") {
            return;
        }

        var challenge = String(data.challenge || "");
        if (!validateHubzamChallenge(challenge)) {
            signerError("Hubzam sent an invalid or expired login challenge. Return to Hubzam and try again.");
            postHubzamMessage("ARKOVIA_HUBZAM_ERROR", {
                message: "The Hubzam login challenge was invalid or expired."
            });
            setSignButtonState("Challenge Rejected", true);
            return;
        }

        hubzamSigner.challenge = challenge;
        $("#sign_message_data").val(challenge).prop("readonly", true);
        setHubzamStatus("Review the one-time login message below, then approve the signature. This cannot move ARKOS or authorize a payment.");
        setSignButtonState("Approve & Sign", false);
    }, false);

    NRS.setTokenPassword = function(password) {
        _password = password;
    };

    $(function() {
        window.setTimeout(initializeHubzamSigner, 250);
    });

    return NRS;
}(NRS || {}, jQuery));
