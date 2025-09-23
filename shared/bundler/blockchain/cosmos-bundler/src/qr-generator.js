// Cosmos Bundler 텍스트를 QR 코드로 변환하는 모듈
import QRCode from 'qrcode';

/**
 * Cosmos Bundler 텍스트를 QR 코드로 변환하는 클래스
 */
export class CosmosBundlerQRGenerator {
    constructor() {
        this.defaultOptions = {
            errorCorrectionLevel: 'M', // 중간 수준의 오류 수정
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
            width: 256,
        };
    }

    /**
     * 텍스트를 QR 코드 이미지로 변환
     * @param {string} text - 변환할 텍스트
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<string>} - Base64 인코딩된 이미지 데이터 URL
     */
    async generateQRCode(text, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error(
                    '유효한 텍스트가 필요합니다.'
                );
            }

            const mergedOptions = {
                ...this.defaultOptions,
                ...options,
            };

            // 텍스트가 너무 길면 경고
            if (text.length > 1000) {
                console.warn(
                    '텍스트가 너무 깁니다. QR 코드 품질이 저하될 수 있습니다.'
                );
            }

            const dataURL = await QRCode.toDataURL(
                text,
                mergedOptions
            );
            return dataURL;
        } catch (error) {
            console.error('QR 코드 생성 실패:', error);
            throw new Error(
                `QR 코드 생성 실패: ${error.message}`
            );
        }
    }

    /**
     * 텍스트를 QR 코드 SVG로 변환
     * @param {string} text - 변환할 텍스트
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<string>} - SVG 문자열
     */
    async generateQRCodeSVG(text, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error(
                    '유효한 텍스트가 필요합니다.'
                );
            }

            const mergedOptions = {
                ...this.defaultOptions,
                ...options,
            };
            delete mergedOptions.type; // SVG에는 type 옵션이 불필요

            const svg = await QRCode.toString(
                text,
                mergedOptions
            );
            return svg;
        } catch (error) {
            console.error('QR 코드 SVG 생성 실패:', error);
            throw new Error(
                `QR 코드 SVG 생성 실패: ${error.message}`
            );
        }
    }

    /**
     * 텍스트를 QR 코드 Canvas로 변환
     * @param {string} text - 변환할 텍스트
     * @param {HTMLCanvasElement} canvas - 대상 Canvas 요소
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<void>}
     */
    async generateQRCodeCanvas(text, canvas, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error(
                    '유효한 텍스트가 필요합니다.'
                );
            }

            if (
                !canvas ||
                !(canvas instanceof HTMLCanvasElement)
            ) {
                throw new Error(
                    '유효한 Canvas 요소가 필요합니다.'
                );
            }

            const mergedOptions = {
                ...this.defaultOptions,
                ...options,
            };
            delete mergedOptions.type; // Canvas에는 type 옵션이 불필요

            await QRCode.toCanvas(
                canvas,
                text,
                mergedOptions
            );
        } catch (error) {
            console.error(
                'QR 코드 Canvas 생성 실패:',
                error
            );
            throw new Error(
                `QR 코드 Canvas 생성 실패: ${error.message}`
            );
        }
    }

    /**
     * 텍스트를 QR 코드 파일로 저장
     * @param {string} text - 변환할 텍스트
     * @param {string} filename - 저장할 파일명
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<void>}
     */
    async generateQRCodeFile(
        text,
        filename = 'cosmos-bundler-qr.png',
        options = {}
    ) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error(
                    '유효한 텍스트가 필요합니다.'
                );
            }

            const mergedOptions = {
                ...this.defaultOptions,
                ...options,
            };

            // 파일 확장자에 따라 타입 설정
            if (filename.endsWith('.svg')) {
                const svg = await this.generateQRCodeSVG(
                    text,
                    mergedOptions
                );
                this.downloadSVG(svg, filename);
            } else {
                const dataURL = await this.generateQRCode(
                    text,
                    mergedOptions
                );
                this.downloadDataURL(dataURL, filename);
            }
        } catch (error) {
            console.error('QR 코드 파일 생성 실패:', error);
            throw new Error(
                `QR 코드 파일 생성 실패: ${error.message}`
            );
        }
    }

    /**
     * SVG 파일 다운로드
     * @param {string} svg - SVG 문자열
     * @param {string} filename - 파일명
     */
    downloadSVG(svg, filename) {
        const blob = new Blob([svg], {
            type: 'image/svg+xml',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Data URL 파일 다운로드
     * @param {string} dataURL - Data URL
     * @param {string} filename - 파일명
     */
    downloadDataURL(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * QR 코드 품질 정보 반환
     * @param {string} text - 텍스트
     * @returns {Object} - 품질 정보
     */
    getQRCodeQualityInfo(text) {
        if (!text)
            return {
                level: 'error',
                message: '텍스트가 없습니다.',
            };

        const length = text.length;
        let level, message, recommendedSize;

        if (length <= 25) {
            level = 'excellent';
            message = '최적의 품질';
            recommendedSize = 128;
        } else if (length <= 50) {
            level = 'good';
            message = '좋은 품질';
            recommendedSize = 192;
        } else if (length <= 100) {
            level = 'fair';
            message = '보통 품질';
            recommendedSize = 256;
        } else if (length <= 200) {
            level = 'poor';
            message = '낮은 품질';
            recommendedSize = 320;
        } else {
            level = 'very-poor';
            message = '매우 낮은 품질';
            recommendedSize = 400;
        }

        return {
            level,
            message,
            textLength: length,
            recommendedSize,
            errorCorrectionLevel: length > 100 ? 'H' : 'M',
        };
    }

    /**
     * Cosmos Bundler 설정을 QR 코드로 변환
     * @param {Object} config - Cosmos 설정 객체
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<string>} - Base64 인코딩된 이미지 데이터 URL
     */
    async generateConfigQRCode(config, options = {}) {
        try {
            if (!config || typeof config !== 'object') {
                throw new Error(
                    '유효한 설정 객체가 필요합니다.'
                );
            }

            // 설정을 JSON 문자열로 변환
            const configText = JSON.stringify(
                config,
                null,
                2
            );

            // 설정 정보를 포함한 QR 코드 생성
            const qrOptions = {
                ...this.defaultOptions,
                ...options,
                errorCorrectionLevel: 'H', // 설정 데이터는 높은 오류 수정 레벨 사용
                width: 320, // 설정 데이터는 더 큰 크기 사용
            };

            return await this.generateQRCode(
                configText,
                qrOptions
            );
        } catch (error) {
            console.error('설정 QR 코드 생성 실패:', error);
            throw new Error(
                `설정 QR 코드 생성 실패: ${error.message}`
            );
        }
    }

    /**
     * 지갑 주소를 QR 코드로 변환
     * @param {string} address - 지갑 주소
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<string>} - Base64 인코딩된 이미지 데이터 URL
     */
    async generateAddressQRCode(address, options = {}) {
        try {
            if (!address || typeof address !== 'string') {
                throw new Error(
                    '유효한 주소가 필요합니다.'
                );
            }

            // 주소 검증 (간단한 형식 검사)
            if (!address.match(/^[a-zA-Z0-9]{26,}$/)) {
                console.warn(
                    '주소 형식이 예상과 다를 수 있습니다.'
                );
            }

            const qrOptions = {
                ...this.defaultOptions,
                ...options,
                width: 256,
            };

            return await this.generateQRCode(
                address,
                qrOptions
            );
        } catch (error) {
            console.error('주소 QR 코드 생성 실패:', error);
            throw new Error(
                `주소 QR 코드 생성 실패: ${error.message}`
            );
        }
    }

    /**
     * 트랜잭션 데이터를 QR 코드로 변환
     * @param {Object} txData - 트랜잭션 데이터
     * @param {Object} options - QR 코드 옵션
     * @returns {Promise<string>} - Base64 인코딩된 이미지 데이터 URL
     */
    async generateTransactionQRCode(txData, options = {}) {
        try {
            if (!txData || typeof txData !== 'object') {
                throw new Error(
                    '유효한 트랜잭션 데이터가 필요합니다.'
                );
            }

            // 트랜잭션 데이터를 JSON 문자열로 변환
            const txText = JSON.stringify(txData, null, 2);

            const qrOptions = {
                ...this.defaultOptions,
                ...options,
                errorCorrectionLevel: 'H',
                width: 320,
            };

            return await this.generateQRCode(
                txText,
                qrOptions
            );
        } catch (error) {
            console.error(
                '트랜잭션 QR 코드 생성 실패:',
                error
            );
            throw new Error(
                `트랜잭션 QR 코드 생성 실패: ${error.message}`
            );
        }
    }
}

// 기본 인스턴스 생성
export const cosmosQRGenerator =
    new CosmosBundlerQRGenerator();

// 전역 변수로 노출 (미니앱에서 사용하기 위해)
if (typeof window !== 'undefined') {
    window.CosmosQRGenerator = CosmosBundlerQRGenerator;
    window.cosmosQRGenerator = cosmosQRGenerator;
}

// UMD를 위한 default export
export default cosmosQRGenerator;
